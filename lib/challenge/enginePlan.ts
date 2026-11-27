import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as CS from "@/lib/interp/vendor/case.mjs";
import * as PS from "@/lib/interp/vendor/personal.mjs";
import * as CH from "@/lib/interp/vendor/challenge.mjs";
import { loadTaskEngine } from "@/lib/tasks/data";
import { loadCardData } from "@/lib/cards/session";
import { personForChallenge } from "@/lib/tasks/server";
import { enginePlanView, practiceIdsOf, tarotPlanView, type PlanView } from "./planView";
import { tarotPlanFrom } from "./tarotPlan";

// 작심삼일 계획을 엔진(ssol_challenge v0.8 · CSO 묶음 v2.44)과 타로 결과에서 만든다 — 2026-11-26 대표님:
//  - 테스트(타로)에서 다섯 칸을 받은 사람은 그 챌린지 그대로(tarotChallenge)
//  - 그냥 온 사람은 질문 3개 답으로 엔진이 사람마다(engineChallenge) · 안 맞으면 셔플(shuffle = 몇 번째로 다시 골랐는지)
//    셔플은 앞에서 나온 활동 가족을 빼고 다시 고른다(엔진 pickFamily의 excludeFamilies). 다 돌면 처음부터.
//  - 무엇을 기준으로 고를지(엔진 순서): 최근 대화의 고민 → 없으면 「가장 중요한 것」 1순위의 세부 고민 → 없으면 취미·주말 답만
type Admin = ReturnType<typeof createAdminClient>;
const MAX_SHUFFLE = 30;

// resultId: 쏠 타로 버튼이 보낸 결과번호(/challenge?from=tarot&result=…, 2026-11-26) — 그 사람 본인의 결과이고 다섯 칸이 있으면 그것.
// 아니면(번호 없음 · 남의 결과 · 아직 다섯 칸 없음) 그 사람의 가장 최근 다섯 칸. 타로 표는 다른 앱 소유라 읽기만 한다.
export async function tarotChallenge(admin: Admin, userId: string, resultId: string | null = null): Promise<PlanView | null> {
  if (resultId) {
    const { data: one } = await admin.from("tarot_sessions").select("report").eq("id", resultId).eq("user_id", userId).maybeSingle();
    const p1 = tarotPlanFrom(one?.report);
    if (p1) return tarotPlanView(p1);
  }
  // 대표님 2026-11-26: "테스트에서 받으면 제일 최근에 받은 챌린지" — 다섯 칸이 들어 있는 결과 중 가장 최근 것
  const { data } = await admin.from("tarot_sessions").select("report").eq("user_id", userId).not("report->challenge", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const p = tarotPlanFrom(data?.report);
  return p ? tarotPlanView(p) : null;
}

async function latestWorry(admin: Admin, userId: string) {
  const { data } = await admin.from("chat_sessions").select("worry_pick").eq("user_id", userId).is("deleted_at", null).not("worry_pick", "is", null).order("last_message_at", { ascending: false }).limit(1).maybeSingle();
  const w = (data?.worry_pick ?? null) as { intent_id?: string | null; branch_id?: string | null } | null;
  return w?.intent_id ? { intentId: w.intent_id, branchId: w.branch_id ?? null } : null;
}

// CSO v2.41(규칙 CH-07): 엔진에 「최근 대화에서 나간 과제(recent)」와 「이미 한 과제(done)」를 넘기면 1·3일차에서 뺀다.
// recent = 최근 14일 대화에서 제안된 과제 · done = 대화에서 골랐던 과제 + 지난 챌린지에서 받은 과제. 읽기 실패는 빈 목록(빼는 것만 못 할 뿐).
const RECENT_DAYS = 14;
async function pastPractices(admin: Admin, userId: string): Promise<{ recent: string[]; done: string[] }> {
  const since = new Date(Date.now() - RECENT_DAYS * 24 * 3600 * 1000).toISOString();
  const [offered, picked, past] = await Promise.all([
    admin.from("sw_user_tasks").select("offered").eq("user_id", userId).gte("at", since).order("at", { ascending: false }).limit(50),
    admin.from("sw_user_tasks").select("practice_id").eq("user_id", userId).not("practice_id", "is", null).order("at", { ascending: false }).limit(100),
    admin.from("challenges").select("plan").eq("user_id", userId).not("plan", "is", null).order("created_at", { ascending: false }).limit(20),
  ]);
  for (const r of [offered, picked, past]) if (r.error) console.error("작심삼일 지난 과제 읽기 실패:", r.error.message);
  const recent = new Set<string>();
  for (const row of offered.data ?? []) for (const id of Array.isArray(row.offered) ? row.offered : []) if (typeof id === "string") recent.add(id);
  const done = new Set<string>((picked.data ?? []).map((r) => r.practice_id).filter((x): x is string => typeof x === "string"));
  for (const id of practiceIdsOf((past.data ?? []).map((r) => r.plan))) done.add(id);
  return { recent: [...recent], done: [...done] };
}

export async function engineChallenge(admin: Admin, userId: string, shuffle = 0): Promise<{ plan: PlanView | null; hasAnswers: boolean }> {
  const [, cardData, { person, hasAnswers }, worry, { recent, done }] = await Promise.all([loadTaskEngine(admin), loadCardData(admin), personForChallenge(admin, userId), latestWorry(admin, userId), pastPractices(admin, userId)]);
  if (!hasAnswers) return { plan: null, hasAnswers };
  const options = cardData.options as never;
  const values = ((person as { prefs?: { values?: string[] } }).prefs?.values ?? []) as string[];
  const interest = (CH.challengeData() as { interest_subs?: Record<string, string[]> }).interest_subs ?? {};
  const intentId = worry?.intentId ?? values.map((v) => interest[v]?.[0]).find(Boolean) ?? null;
  const tc = (intentId ? CS.taskCandidates([], options, { intentId, branchId: worry?.intentId === intentId ? (worry.branchId ?? undefined) : undefined }) : { candidates: [], roots: [] }) as Record<string, unknown> & { candidates: { practice_id: string }[]; roots: string[] };
  const cs = CS.newConcernState(userId, "challenge");
  CS.applyCardPath(cs, [], tc.roots ?? [], {});
  PS.fillCoping(cs, person);
  const personal = PS.scorer(cs, person, intentId as never);

  const n = Math.max(0, Math.min(MAX_SHUFFLE, Math.floor(shuffle)));
  const excludeFamilies: string[] = [];
  const usedDay1: string[] = [];
  let raw: Record<string, unknown> | null = null;
  for (let i = 0; i <= n; i++) {
    const cands = tc.candidates.filter((c) => !usedDay1.includes(c.practice_id));
    let r = CH.challengePlan({ tc: { ...tc, candidates: cands }, cs, personal, person, formatOf: PS.sizeOf, intentId, excludeFamilies, recent, done } as never) as Record<string, unknown> & { family_id?: string | null; day1?: { practice_id?: string } | null };
    if (!r.family_id && excludeFamilies.length) { excludeFamilies.length = 0; usedDay1.length = 0; r = CH.challengePlan({ tc, cs, personal, person, formatOf: PS.sizeOf, intentId, excludeFamilies, recent, done } as never) as typeof r; } // 다 돌았으면 처음부터
    if (r.family_id) excludeFamilies.push(r.family_id);
    if (r.day1?.practice_id) usedDay1.push(r.day1.practice_id);
    raw = r;
  }
  return { plan: enginePlanView(raw as never), hasAnswers };
}
