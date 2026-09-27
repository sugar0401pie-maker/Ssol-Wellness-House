// 요금 상수 — 화면(가격 표시)과 결제 신청(app/api/billing/checkout)이 같은 값을 쓰도록 한 곳에 모은다.
// 2026-09-27 결정: 가입 후 7일 무료체험, 이후 월간 7,900원 또는 연간 60,000원(월 환산 5,000원).
export const TRIAL_DAYS = 7;

export const MONTHLY_PRICE = 7900;
export const ANNUAL_PRICE = 60000;
export const ANNUAL_MONTHLY_EQUIVALENT = Math.round(ANNUAL_PRICE / 12); // 5,000원

// 연간 결제가 월간을 12번 결제하는 것보다 얼마나 저렴한지 — 가격 페이지 안내 문구용.
export const ANNUAL_SAVINGS_AMOUNT = MONTHLY_PRICE * 12 - ANNUAL_PRICE;
export const ANNUAL_SAVINGS_PERCENT = Math.round((ANNUAL_SAVINGS_AMOUNT / (MONTHLY_PRICE * 12)) * 100);

export type PlanId = "monthly" | "annual";

export const PLAN_LABELS: Record<PlanId, string> = {
  monthly: "월간 이용권",
  annual: "연간 이용권",
};

export const PLAN_PRICES: Record<PlanId, number> = {
  monthly: MONTHLY_PRICE,
  annual: ANNUAL_PRICE,
};
