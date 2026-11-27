// 작심삼일 챌린지 계획을 화면·서버가 같은 모양으로 다루는 순수 함수 — 2026-11-26 대표님 + CSO 묶음 v2.40.
// 계획이 오는 곳 셋: ① 세 가지 마음(themes.ts — 예전 그대로) ② 엔진(ssol_challenge.challengePlan — 질문 3개 답으로 사람마다)
// ③ 타로가 준 다섯 칸(tarotPlan.ts). 셋 다 { 3일 글 · 그날 남겨 볼 것 · 1주일 · 1달 }로 바꿔 쓴다. 클라이언트도 쓰므로 "server-only"를 넣지 않는다.
import { CHALLENGE_THEMES, isThemeKey, proofLine, themeOf } from "./themes.ts";
import type { TarotChallengePlan } from "./tarotPlan.ts";

export type PlanSource = "theme" | "engine" | "tarot";
// ask: 그날 과제 앞에 보여 줄 한 줄 질문(엔진 3일차 「어제 해 본 ○○, 어땠어요?」 — CSO v2.41 규칙 CH-07) · practiceId: 엔진 과제 코드
// (다음 챌린지에서 「이미 한 과제」로 빼려고 남김). 둘 다 없어도 되는 값이라 예전에 저장한 계획도 그대로 읽힌다.
export type PlanDay = { action: string; proof: string | null; ask?: string | null; practiceId?: string | null };
export type PlanView = {
  source: PlanSource;
  key: string; // 세 가지 마음이면 그 키, 엔진이면 "me", 타로면 "tarot" (challenges.theme에 그대로)
  label: string;
  days: [PlanDay, PlanDay, PlanDay];
  week: string | null;
  month: string | null;
  familyId?: string | null;
};

export const ENGINE_KEY = "me";
export const TAROT_KEY = "tarot";
export const ENGINE_LABEL = "나에게 맞춘 챌린지";
export const TAROT_LABEL = "타로에서 받은 챌린지";

// 시작 화면 주소(/challenge/start/<키>)로 받을 수 있는 키
export const isStartKey = (k: unknown): k is string => isThemeKey(k) || k === ENGINE_KEY || k === TAROT_KEY;

export function themePlan(key: string): PlanView {
  const t = themeOf(key);
  return {
    source: "theme", key: t.key, label: t.label,
    days: [0, 1, 2].map((i) => ({ action: t.days[i].action, proof: proofLine(t.key, i) })) as [PlanDay, PlanDay, PlanDay],
    week: t.week, month: t.month,
  };
}

// 셔플: 세 가지 마음은 순서대로 다음 것(마지막 다음은 처음)
export function nextThemeKey(key: string): string {
  const i = CHALLENGE_THEMES.findIndex((t) => t.key === key);
  return CHALLENGE_THEMES[(i + 1) % CHALLENGE_THEMES.length].key;
}

const clean = (s: unknown): string | null => (typeof s === "string" && s.trim() ? s.replace(/\s+/g, " ").trim() : null);

export function tarotPlanView(p: TarotChallengePlan): PlanView {
  const d = (s: TarotChallengePlan["day1"]): PlanDay => ({ action: s.title, proof: s.description });
  return { source: "tarot", key: TAROT_KEY, label: TAROT_LABEL, days: [d(p.day1), d(p.day2), d(p.day3)], week: p.week?.title ?? null, month: p.month?.title ?? null };
}

// 엔진 challengePlan 결과 → 화면 계획. 3일 중 하나라도 글이 없으면 null(그때는 세 가지 마음으로).
// 3일차는 두 가지로 온다(CSO v2.41~v2.44 · ssol_challenge v0.5~v0.8): kind 'task' = 새 과제(제목 · 설명 + check_in 한 줄 질문),
// kind 'review' = 예전처럼 돌아보기(steps). 둘 다 받는다.
type EngineSlot = { title?: string | null; description?: string | null; steps?: unknown; practice_id?: string | null; kind?: string | null; check_in?: string | null } | null | undefined;
type EngineRaw = { family_id?: string | null; category?: string | null; day1?: EngineSlot; day2?: EngineSlot; day3?: EngineSlot; week?: EngineSlot; month?: EngineSlot } | null | undefined;
export function enginePlanView(raw: EngineRaw): PlanView | null {
  if (!raw) return null;
  const a1 = clean(raw.day1?.title), a2 = clean(raw.day2?.title), a3 = clean(raw.day3?.title);
  if (!a1 || !a2 || !a3) return null;
  const d3 = raw.day3!;
  const steps = Array.isArray(d3.steps) ? (d3.steps as unknown[]).map(clean).filter((x): x is string => !!x) : [];
  const day3: PlanDay = d3.kind === "task"
    ? { action: a3, proof: clean(d3.description), ask: clean(d3.check_in), practiceId: clean(d3.practice_id) }
    : { action: a3, proof: steps.length ? steps.join(" · ") : clean(d3.description) };
  return {
    source: "engine", key: ENGINE_KEY, label: clean(raw.category) ?? ENGINE_LABEL,
    days: [
      { action: a1, proof: clean(raw.day1?.description), practiceId: clean(raw.day1?.practice_id) },
      { action: a2, proof: clean(raw.day2?.description), practiceId: clean(raw.day2?.practice_id) },
      day3,
    ],
    week: clean(raw.week?.title), month: clean(raw.month?.title), familyId: raw.family_id ?? null,
  };
}

// 이미 한 챌린지들의 계획에서 엔진 과제 코드만(다음 계획에서 다시 안 나오게 — challengePlan의 done)
export function practiceIdsOf(plans: unknown[]): string[] {
  const out = new Set<string>();
  for (const p of plans) if (isPlanView(p)) for (const d of p.days) if (typeof d.practiceId === "string" && d.practiceId) out.add(d.practiceId);
  return [...out];
}

// 저장된 챌린지 → 계획(시작할 때 남긴 plan이 있으면 그것, 없으면 예전처럼 세 가지 마음)
export function isPlanView(v: unknown): v is PlanView {
  const p = v as PlanView | null;
  return !!p && typeof p === "object" && Array.isArray(p.days) && p.days.length === 3 && p.days.every((d) => d && typeof d.action === "string" && d.action.length > 0) && typeof p.label === "string";
}
export function planOf(c: { theme: string; plan?: unknown } | null | undefined): PlanView {
  return c && isPlanView(c.plan) ? c.plan : themePlan(c?.theme ?? CHALLENGE_THEMES[0].key);
}
