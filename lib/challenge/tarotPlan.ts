// 쏠 타로가 넘겨 주는 작심삼일 다섯 칸(1·2·3일차 · 1주일 · 1달)을 읽는 순수 함수 — 2026-11-26 CSO 묶음 v2.40(규칙 CH-02 "타로 계획 그대로").
// 받는 곳: tarot_sessions.report.challenge (쏠 타로 앱이 결과를 만들 때 같이 저장 — 대표님이 타로 쪽에서 만들기로 함 2026-11-26).
//   { "day1": 칸, "day2": 칸, "day3": 칸, "week": 칸, "month": 칸 }
//   칸 = 글 한 줄(문자열) 또는 { "title": "…", "description": "…", "practice_id": "…" } (description · practice_id는 없어도 됨)
// 엔진 ssol_challenge.fromTarotPlan이 받는 모양과 같다. 이상한 값은 버리고, 1·2·3일차 제목이 모두 있을 때만 계획으로 본다
// (챌린지는 3일을 채워야 하니까 — 1주일·1달은 없어도 됨). 클라이언트도 쓰므로 "server-only"를 넣지 않는다.

export type PlanSlot = { title: string; description: string | null; practice_id: string | null };
export type TarotChallengePlan = { day1: PlanSlot; day2: PlanSlot; day3: PlanSlot; week: PlanSlot | null; month: PlanSlot | null };

const TITLE_MAX = 80;
const DESC_MAX = 300;

function slotOf(v: unknown): PlanSlot | null {
  const o = typeof v === "string" ? { title: v } : v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  if (!o) return null;
  const title = typeof o.title === "string" ? o.title.replace(/\s+/g, " ").trim() : "";
  if (!title || [...title].length > TITLE_MAX) return null;
  const d = typeof o.description === "string" ? o.description.trim() : "";
  const pid = typeof o.practice_id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(o.practice_id) ? o.practice_id : null;
  return { title, description: d && [...d].length <= DESC_MAX ? d : null, practice_id: pid };
}

export function tarotPlanFrom(report: unknown): TarotChallengePlan | null {
  const c = report && typeof report === "object" ? (report as Record<string, unknown>).challenge : null;
  if (!c || typeof c !== "object") return null;
  const r = c as Record<string, unknown>;
  const day1 = slotOf(r.day1), day2 = slotOf(r.day2), day3 = slotOf(r.day3);
  if (!day1 || !day2 || !day3) return null;
  return { day1, day2, day3, week: slotOf(r.week), month: slotOf(r.month) };
}
