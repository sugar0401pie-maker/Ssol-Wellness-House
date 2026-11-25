// 온보딩 질문마다 주소(대표님 2026-11-25): /onboarding/1 ~ /onboarding/9, 마지막 동의 화면은 /onboarding/agree. 질문 수(total)는 schema의 QUESTIONS.length.
export const ONBOARDING_AGREE = "agree";

export function onboardingStepPath(stepIndex: number, total: number): string {
  return stepIndex >= total ? `/onboarding/${ONBOARDING_AGREE}` : `/onboarding/${Math.max(0, stepIndex) + 1}`;
}

// 주소 조각 → 보여 줄 칸(0부터). 맞지 않는 값이면 null.
export function onboardingStepFrom(seg: string, total: number): number | null {
  if (seg === ONBOARDING_AGREE) return total;
  if (!/^[1-9][0-9]?$/.test(seg)) return null;
  const n = Number(seg);
  return n >= 1 && n <= total ? n - 1 : null;
}
