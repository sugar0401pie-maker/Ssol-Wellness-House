// 온보딩 권유 시점 — 순수 함수(2026-11-24 대표님 결정).
// 온보딩은 팝업으로 띄우지 않고, 쏘웰라를 쓰기 시작한 지 3일차부터 채팅 첫머리에 권유만 한다("온보딩 없어도 대화는 이어나갈 수 있어요").
// 쓰기 시작한 날 = 무료체험 시작일(profiles.trial_started_at — 쏘웰라에 처음 들어온 시각). 한국 날짜로 센다(시작한 날 = 1일차).
// "server-only"를 넣지 않는다(시험이 바로 읽는다).
export const ONBOARDING_PROMPT_FROM_DAY = 3;

const kstDayIndex = (t: number) => Math.floor((t + 9 * 3600 * 1000) / 86400000);

// 시작 시각을 모르면 null(권유하지 않음 — 더 가벼운 쪽).
export function dayOfUseKST(startedAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!startedAt) return null;
  const t = new Date(startedAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(1, kstDayIndex(now.getTime()) - kstDayIndex(t) + 1);
}

export function onboardingPromptDue(p: { needsOnboarding: boolean; useDay: number | null }): boolean {
  return p.needsOnboarding && p.useDay !== null && p.useDay >= ONBOARDING_PROMPT_FROM_DAY;
}
