import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as RS from "./vendor/rootState.mjs";
import * as OB from "./vendor/onboardingScoring.mjs";
import * as LD from "./vendor/dbLoader.mjs";
import * as K from "./vendor/claimClassifier.mjs";
import { chatFacts, chatSignature, claimsFromStates } from "./onboardingChat";
import { mapOnboardingAnswers, onboardingEligible } from "./onboardingInput";
import { buildTestInput, forInstrument } from "./testInput";

// 온보딩 답을 해석 장부에 근거 F등급으로 반영한다(2026-10-20, 로드맵 7번 — 온보딩 단서). CSO 채점 코드(OB-01~10)를 그대로 쓴다:
// 가설 단서 = 문항 무게 × 순위 + 수렴 신호(맞은 조건당 +0.5, 최대 1.0) + 조합 +0.5, 뿌리당 최대 2.5, 같은 뿌리는 가장 큰 값 하나.
// 개인화 동의를 하고 온보딩을 끝낸 사용자만 반영하고, 동의를 거두거나 답을 고치면 이전 온보딩 근거는 정정 처리된다(같은 출처 한 벌로 대체).
// 가중치는 CSO "검수 전 초안"이다 → 끄기: SW_ONBOARDING_CUES=0. 심리테스트·나이는 이 계산의 "최신 상태"로 메모리에서 합쳐 쓰고
// sw_user_signals에는 쓰지 않는다(우리는 장부만 쓴다). 변화 조건(changed)은 이력이 없어 맞지 않는 것으로 본다.
type Admin = ReturnType<typeof createAdminClient>;

const TABLES = [
  "sw_ob_test_bands", "sw_ob_test_domains", "sw_ob_test_root_pairs", "sw_ob_test_root_cues", "sw_ob_astro_cues", "sw_ob_hypotheses",
  "sw_ob_option_groups", "sw_ob_combos", "sw_ob_option_axes", "sw_ob_dessert_types", "sw_ob_node_polarity", "sw_ob_hyp_chat_links",
] as const;

let cache: { at: number; onboarding: unknown } | null = null;
async function loadEngineData(admin: Admin) {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache.onboarding;
  const t: Record<string, unknown[]> = {};
  const res = await Promise.all(TABLES.map(async (name) => {
    const out: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from(name).select("*").range(from, from + 999);
      if (error) throw new Error(`${name} 읽기 실패: ${error.code}`);
      out.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) break;
    }
    return [name, out] as const;
  }));
  for (const [n, rows] of res) t[n] = rows;
  // 디저트 테스트 한 벌만 쓴다(instrument 칸이 없으면 디저트로 본다).
  for (const k of ["sw_ob_test_bands", "sw_ob_test_domains", "sw_ob_test_root_pairs", "sw_ob_test_root_cues"]) t[k] = forInstrument(t[k] as { instrument?: string | null }[]);
  const onboarding = LD.onboardingFromDb(t);
  cache = { at: Date.now(), onboarding };
  return onboarding;
}

const memo = new Map<string, string>();
export async function syncOnboardingEvidence(admin: Admin, userId: string): Promise<void> {
  if (process.env.SW_ONBOARDING_CUES === "0") return;
  const [{ data: ob }, { data: profile }, { data: quiz }] = await Promise.all([
    admin.from("user_onboarding").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("profiles").select("birth_date, primary_quiz_result_id").eq("user_id", userId).maybeSingle(),
    admin.from("ssol_quiz_results").select("id, type_key, factor_scores, sub_scores, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const eligible = onboardingEligible(ob);
  const baseKey = JSON.stringify([eligible, ob?.updated_at, ob?.personalization_consent, profile?.birth_date, quiz?.id]);
  if (!eligible && memo.get(userId) === baseKey) return; // 대상이 아니고 달라진 게 없으면 장부도 읽지 않는다

  const { data: ledger, error } = await admin.rpc("sw_read_ledger", { p_user: userId });
  if (error) throw new Error(`sw_read_ledger ${error.code}`);
  const states = RS.hydrate(userId, ledger ?? [], []);
  const hasOld = Object.values(states).some((s: { ledger?: { source: string; validity: string }[] }) => (s.ledger ?? []).some((e) => e.source === "onboarding" && e.validity === "active"));
  if (!eligible && !hasOld) { memo.set(userId, baseKey); return; } // 할 일이 없으면 엔진 데이터도 읽지 않는다

  // CSO OB-16(엔진 v1.8): 대화에서 확인된 사실(장부의 대화 근거 claim + 사용자가 꺼낸 주제)이 온보딩 가설의 "대화 조각" 연결과 맞으면 수렴 신호로 센다.
  // 대화 사실이 달라질 때만 다시 계산하도록 서명을 key에 넣는다. 최근 사용자 말은 주제를 읽는 데만 쓰고 저장하지 않는다. 끄기: SW_ONBOARDING_CHAT=0.
  let chat: ReturnType<typeof chatFacts> | null = null;
  if (eligible && process.env.SW_ONBOARDING_CHAT !== "0") {
    const { data: recent } = await admin.from("chat_messages").select("content").eq("user_id", userId).eq("role", "user").order("created_at", { ascending: false }).limit(30);
    chat = chatFacts(claimsFromStates(states as never), (recent ?? []).map((m) => String(m.content ?? "")), K.saidTopics as (t: string) => string[]);
  }
  const key = `${baseKey}|${chatSignature(chat)}`;
  if (memo.get(userId) === key) return;

  let cues: unknown[] = [];
  if (eligible) {
    const data = await loadEngineData(admin);
    OB.setData(data as never);
    const answers = mapOnboardingAnswers(ob);
    const prof = OB.computeOnboardingProfile(answers);
    const now = new Date().toISOString();
    const at = ob.completed_at ?? ob.updated_at ?? now;
    const signals: unknown[] = [...OB.onboardingToSignals(prof)];
    const test = buildTestInput(quiz);
    if (test) signals.push(...OB.testToSignals({ instrument: test.instrument, typeCode: test.main_domain && test.coping ? `${test.main_domain}-${test.coping}` : undefined, factorScores: test.factorScores, copingSub: test.copingSub }, test.at ?? at));
    signals.push(...OB.profileSignals({ birthDate: profile?.birth_date ?? undefined, now, source: "onboarding" } as never)); // 엔진 JS의 추론 타입이 좁아 형태만 맞춰 넘긴다
    cues = OB.onboardingRootCues(answers, prof, OB.currentState(signals as never, now) as never, chat as never);
  }
  const sink: unknown[] = [];
  RS.applyOnboardingSet(states, userId, cues, sink);
  if (sink.length) {
    const { error: oe } = await admin.rpc("sw_apply_ops", { p_user: userId, p_ops: sink });
    if (oe) throw new Error(`sw_apply_ops ${oe.code}`);
  }
  memo.set(userId, key);
}
