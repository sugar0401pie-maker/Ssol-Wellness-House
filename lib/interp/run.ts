import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClassifierModel, CLASSIFIER_MODEL_NAME } from "@/lib/ai/classifierModel";
import * as RS from "./vendor/rootState.mjs";
import { classifyUtterance } from "./classify";
import { getClassifierData } from "./dataStore";
import { embedTexts } from "./embed";
import { interpRoutes, isInterpEnabled, shouldAnalyze } from "./gate";
import { maskEvents } from "./healthMask";

// 답변을 보낸 뒤 뒤에서 도는 발화 해석(2026-10-18). 결과는 다음 턴부터 반영된다(지연 0).
// 흐름: 켜짐·대상 확인 → 분류(임베딩 후보 + 모델) → 장부에서 상태 다시 읽기 → 같은 의미 한 번만 반영 → sw_apply_ops(원자적·멱등) → 판정 기록.
// 실패해도 채팅에는 영향이 없고, 대화 내용은 로그에 남기지 않는다(CLAUDE.md §8). 위기·폭력은 이 경로에 오지 않는다(앞 단계에서 끝남).
export const SPEC_VERSION = "interp-v0.5/classifier-v0.2";

export type InterpParams = {
  userId: string;
  sessionId: string;
  messageId: string;
  text: string;
  route: string;
  lastBot?: string | null;
};

const emailCache = new Map<string, string | null>();
async function emailOf(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
  if (emailCache.has(userId)) return emailCache.get(userId)!;
  const { data } = await admin.auth.admin.getUserById(userId);
  const email = data?.user?.email ?? null;
  emailCache.set(userId, email);
  return email;
}

export async function runInterpretation(p: InterpParams): Promise<void> {
  try {
    const env = process.env as { SW_INTERP_ENABLED?: string; SW_INTERP_ALLOWLIST?: string };
    if (env.SW_INTERP_ENABLED !== "1") return;
    if (!shouldAnalyze(p.route, p.text, interpRoutes(process.env.SW_INTERP_ROUTES))) return;
    const admin = createAdminClient();
    const listed = isInterpEnabled(env, p.userId) || isInterpEnabled(env, p.userId, await emailOf(admin, p.userId));
    if (!listed) return;

    const { index } = await getClassifierData(admin);
    const cls = await classifyUtterance(
      p.text,
      { lastBot: p.lastBot ?? null, messageId: p.messageId, chatId: p.sessionId },
      { embed: embedTexts, index, callModel: callClassifierModel },
    );
    if (cls.safety_suspect) return; // 위기로 보이는 말 — 점수를 만들지 않는다(판단은 lib/safety)
    if (!cls.events.length) return;

    // 장부에 저장하는 사용자 말 조각: 질병명·진단·약 같은 직접 건강 표현은 "[건강]"으로 가린다(owner 결정 2026-10-18 — 대화는 그대로 들어 주고
    // 저장되는 조각에서만 가린다. 감정·컨디션 표현은 남음). SW_STORE_EVIDENCE=0이면 조각 자체를 저장하지 않는다.
    const events = maskEvents(process.env.SW_STORE_EVIDENCE === "0" ? cls.events.map((e) => ({ ...e, evidence: undefined })) : cls.events);
    const { data: ledger, error: le } = await admin.rpc("sw_read_ledger", { p_user: p.userId });
    if (le) throw new Error(`sw_read_ledger ${le.code}`);
    const states = RS.hydrate(p.userId, ledger ?? [], []);
    const sink: unknown[] = [];
    RS.applyChatClaims(states, p.userId, events, sink);
    if (sink.length) {
      const { error } = await admin.rpc("sw_apply_ops", { p_user: p.userId, p_ops: sink });
      if (error) throw new Error(`sw_apply_ops ${error.code}`);
    }

    // 판정 기록(확률 보정용 재료) — 후보 전체와 누가 골랐는지. 사용자 반응(outcome)은 나중에 채운다.
    const applied = cls.events.filter((e) => e.op === "apply");
    const top = [...applied].sort((a, b) => b.confidence - a.confidence)[0];
    await admin.from("sw_hypothesis_log").insert({
      user_id: p.userId,
      chat_id: p.sessionId,
      candidates: cls.events.map((e) => ({ root_id: e.root_id, claim_id: e.claim_id, confidence: e.confidence, points: e.points, link: e.link, op: e.op })),
      chosen_root: top?.root_id ?? null,
      chosen_by: top ? "ai" : "none",
      model_version: CLASSIFIER_MODEL_NAME,
      spec_version: SPEC_VERSION,
    });
  } catch (e) {
    console.error("발화 해석 실패(채팅에는 영향 없음):", e instanceof Error ? e.message.slice(0, 120) : "unknown");
  }
}
