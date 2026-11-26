import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as CS from "@/lib/interp/vendor/case.mjs";
import * as DY from "@/lib/interp/vendor/daily.mjs";
import { loadTaskEngine } from "@/lib/tasks/data";
import { loadCardData } from "@/lib/cards/session";
import { personFor } from "@/lib/tasks/server";
import { addDays } from "@/lib/challenge/state";
import { tarotPlanFrom } from "@/lib/challenge/tarotPlan";
import { passesServingRules, type ServingContext } from "@/lib/onboarding/servingRules";

// 고민 타파 「오늘 이렇게 해보면 어떨까요?」 — CSO 묶음 v2.40(엔진 ssol_daily · 규칙 DAILY-01): "홈 카드는 dailySuggestion 하나만 불러 주세요".
// 고르는 순서(엔진): ① 타로 계획의 오늘 칸 → ② 타로가 준 세부 고민·갈래 → ③ 다른 테스트 → ④ 최근 대화의 고민 → ⑤ 온보딩 관심 분야.
//  - ③ 다른 테스트(점성술·심리테스트)는 결과가 세부 고민 코드를 주지 않아 지금은 넘기지 않는다 — 그 결과는 이미 뿌리 장부(person.rootStates)로 들어가 점수에 쓰인다.
//  - 하루에 하나: daily_suggestions에 남겨 같은 날은 같은 제안, 다음 날은 최근 7개(엔진 DAILY_CFG.recentN)를 뺀 새 제안.
//  - 운영 실천표의 노출 규칙(탐색 뒤에만 · 노출 단계 · 위기 이력)은 홈 카드에도 그대로 — 걸리면 그 실천을 빼고 다시 고른다.
// 엔진이 아무것도 못 고르거나 실패하면 null(부르는 쪽이 예전 방식으로 고른다 — 카드가 비지 않게).
type Admin = ReturnType<typeof createAdminClient>;
export type EngineDaily = { practiceId: string | null; title: string; detail: string | null; source: string; why: string | null };
type Suggestion = { source: string; why?: string; practice_id?: string | null; title?: string | null; description?: string | null };

const TRIES = 4;

async function recentRows(admin: Admin, userId: string, dateKey: string) {
  const { data, error } = await admin
    .from("daily_suggestions").select("day_kst,practice_id,title,detail,source,why")
    .eq("user_id", userId).gte("day_kst", addDays(dateKey, -7)).order("day_kst", { ascending: false });
  if (error) throw new Error(`daily_suggestions 읽기 ${error.code}`);
  return (data ?? []) as { day_kst: string; practice_id: string | null; title: string; detail: string | null; source: string; why: string | null }[];
}

// 타로: 가장 최근 결과의 세부 고민·갈래(frame) + 넘겨 준 다섯 칸(report.challenge). 다른 앱 표라 읽기만 한다.
async function latestTarot(admin: Admin, userId: string) {
  const { data } = await admin.from("tarot_sessions").select("frame,report").eq("user_id", userId).not("frame", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  const frame = (data.frame ?? {}) as { sub_id?: unknown; branches?: unknown };
  const intentId = typeof frame.sub_id === "string" ? frame.sub_id : null;
  const branchId = Array.isArray(frame.branches) && typeof frame.branches[0] === "string" ? frame.branches[0] : null;
  return { intentId, branchId, plan: tarotPlanFrom(data.report) };
}

// 타로 계획으로 시작한 챌린지가 진행 중이면 오늘이 몇 번째 칸인지(1·2·3일차 → 다 채우면 1주일).
async function tarotDay(admin: Admin, userId: string): Promise<1 | 2 | 3 | "week" | null> {
  const { data } = await admin.from("challenges").select("id,source").eq("user_id", userId).is("closed_at", null).maybeSingle();
  if (!data || data.source !== "tarot") return null;
  const { count } = await admin.from("challenge_checkins").select("id", { count: "exact", head: true }).eq("challenge_id", data.id);
  const n = (count ?? 0) + 1;
  return n > 3 ? "week" : (n as 1 | 2 | 3);
}

async function latestWorry(admin: Admin, userId: string) {
  const { data } = await admin.from("chat_sessions").select("worry_pick").eq("user_id", userId).is("deleted_at", null).not("worry_pick", "is", null).order("last_message_at", { ascending: false }).limit(1).maybeSingle();
  const w = (data?.worry_pick ?? null) as { intent_id?: string | null; branch_id?: string | null } | null;
  return w?.intent_id ? { intentId: w.intent_id, branchId: w.branch_id ?? null } : null;
}

async function servable(admin: Admin, practiceId: string, serving: ServingContext): Promise<{ ok: boolean; title?: string; detail?: string }> {
  const { data } = await admin.from("wellness_practices").select("title,detail,availability,exposure_flag,exposure_step").eq("id", practiceId).maybeSingle();
  if (!data) return { ok: false };
  const ok = passesServingRules({ availability: data.availability, exposureFlag: data.exposure_flag, exposureStep: data.exposure_step }, serving);
  return { ok, title: data.title, detail: data.detail };
}

export async function engineDailySuggestion(admin: Admin, userId: string, dateKey: string, serving: ServingContext): Promise<EngineDaily | null> {
  const recent = await recentRows(admin, userId, dateKey);
  const today = recent.find((r) => r.day_kst === dateKey);
  if (today) return { practiceId: today.practice_id, title: today.title, detail: today.detail, source: today.source, why: today.why };

  const [, cardData, person, tarot, day, worry, { data: doneRows }] = await Promise.all([
    loadTaskEngine(admin), loadCardData(admin), personFor(admin, userId), latestTarot(admin, userId), tarotDay(admin, userId), latestWorry(admin, userId),
    admin.from("sw_user_tasks").select("practice_id").eq("user_id", userId).eq("result", "다 함"),
  ]);
  const options = cardData.options;
  const tc = worry ? CS.taskCandidates([], options as never, { intentId: worry.intentId, branchId: worry.branchId ?? undefined }) : null;
  const skip = recent.map((r) => r.practice_id).filter((x): x is string => !!x);
  const done = ((doneRows ?? []) as { practice_id: string | null }[]).map((r) => r.practice_id).filter((x): x is string => !!x);
  const dayIndex = Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 86_400_000);

  for (let i = 0; i < TRIES; i++) {
    const s = DY.dailySuggestion({
      tarot: tarot ? { plan: tarot.plan && day ? tarot.plan : null, day, intentId: tarot.intentId, branchId: tarot.branchId } : null,
      tests: [], tc, person, options, recent: skip, done, dayIndex, userId,
    } as never) as Suggestion | null;
    if (!s?.title) return null;
    let title = s.title, detail = s.description ?? null;
    if (s.practice_id) {
      const v = await servable(admin, s.practice_id, serving);
      if (!v.ok) { skip.push(s.practice_id); continue; } // 노출 규칙에 걸림 — 빼고 다시
      title = v.title ?? title; detail = v.detail ?? detail; // 화면 글은 운영 실천표 판으로
    }
    const row = { user_id: userId, day_kst: dateKey, practice_id: s.practice_id ?? null, title, detail, source: s.source, why: s.why ?? null };
    const { error } = await admin.from("daily_suggestions").upsert(row, { onConflict: "user_id,day_kst", ignoreDuplicates: true });
    if (error) console.warn("오늘의 제안 기록 실패:", error.code);
    // 동시에 두 요청이 왔으면 먼저 남은 것을 따른다(같은 날 같은 제안).
    const again = (await recentRows(admin, userId, dateKey)).find((r) => r.day_kst === dateKey);
    if (again) return { practiceId: again.practice_id, title: again.title, detail: again.detail, source: again.source, why: again.why };
    return { practiceId: row.practice_id, title, detail, source: row.source, why: row.why };
  }
  return null;
}

// 예전 방식으로 고른 제안도 같은 표에 남긴다(다음 날 겹치지 않게 · 같은 날 같은 제안).
export async function rememberFallback(admin: Admin, userId: string, dateKey: string, p: { id: string; title: string; detail: string }): Promise<void> {
  const { error } = await admin.from("daily_suggestions").upsert(
    { user_id: userId, day_kst: dateKey, practice_id: p.id, title: p.title, detail: p.detail, source: "fallback", why: null },
    { onConflict: "user_id,day_kst", ignoreDuplicates: true },
  );
  if (error) console.warn("오늘의 제안 기록 실패:", error.code);
}
