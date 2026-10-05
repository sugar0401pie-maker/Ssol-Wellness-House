// 요금 상수 — 화면(가격 표시)과 결제 신청(app/api/billing/checkout)이 같은 값을 쓰도록 한 곳에 모은다.
// 2026-09-27 결정: 가입 후 7일 무료체험, 이후 월간 7,900원 또는 연간 60,000원(월 환산 5,000원).
// 2026-10-01 owner 결정: 무료체험 기간을 심층보고서(ssol_reports, status='ready') 보유 여부로
// 차등 적용 — 보고서가 있으면 7일, 없으면 3일. 보고서가 체험 중간에 생기면(퀴즈를 나중에
// 완료) 다음 접근 판정부터 바로 7일 기준으로 다시 계산된다(lib/billing/access.ts 참고).
export const TRIAL_DAYS_WITH_REPORT = 7;
export const TRIAL_DAYS_WITHOUT_REPORT = 3;

export const MONTHLY_PRICE = 7900;
export const ANNUAL_PRICE = 60000;
export const ANNUAL_MONTHLY_EQUIVALENT = Math.round(ANNUAL_PRICE / 12); // 5,000원

// 연간 결제가 월간을 12번 결제하는 것보다 얼마나 저렴한지 — 가격 페이지 안내 문구용.
export const ANNUAL_SAVINGS_AMOUNT = MONTHLY_PRICE * 12 - ANNUAL_PRICE;
export const ANNUAL_SAVINGS_PERCENT = Math.round((ANNUAL_SAVINGS_AMOUNT / (MONTHLY_PRICE * 12)) * 100);

// 2026-10-05: 10월 한정 3개월권("quarterly")이 추가됐다. 3개월권은 프로모션 기간에만 존재하는
// 이용권이라 평소 정가(PLAN_PRICES)가 없고, 기간 밖에서는 구매할 수 없다(currentPrice가 null).
export type PlanId = "monthly" | "quarterly" | "annual";

export function isPlanId(v: unknown): v is PlanId {
  return v === "monthly" || v === "quarterly" || v === "annual";
}

export const PLAN_LABELS: Record<PlanId, string> = {
  monthly: "월간 멤버십",
  quarterly: "3개월 멤버십",
  annual: "연간 멤버십",
};

// 프로모션이 아닐 때의 평소 정가. 3개월권은 평소에 판매하지 않으므로 여기에 없다.
export const PLAN_PRICES: Record<"monthly" | "annual", number> = {
  monthly: MONTHLY_PRICE,
  annual: ANNUAL_PRICE,
};

// 2026-10-01 owner 결정: "10월 한정 · 오픈 기념 이용권 할인" 프로모션 — 월간 7,900원->2,900원,
// 연간 60,000원->22,800원(월 환산 1,900원), 2026년 10월 한 달간. 실제 결제 금액(체크아웃)과
// 가격 페이지 표시가 항상 같은 값을 보도록 currentPrice() 한 곳에서만 계산해서 양쪽이 쓴다 —
// 둘 중 하나만 프로모션가를 반영하면 "화면엔 2,900원인데 실제로는 7,900원 결제됨" 같은 금액
// 불일치 사고가 난다.
//
// 2026-10-05 owner 변경: 1개월권 2,900원 -> 3,500원(정가 7,900원에서 할인), 그리고 3개월권 신설 —
// 3개월 한 번에 결제하는 실제 청구 금액 5,700원(월 1,900원 x 3개월). owner가 처음 "실제 결제 8,700원"
// 이라고 했지만 월 1,900원 표시와 합계가 맞지 않아(8,700원은 월 2,900원 x 3) 확인을 거쳐 5,700원으로
// 확정했다 — 화면의 "월 1,900원"과 실제 청구가 어긋나지 않게 하기 위함.
export const PROMO_MONTHLY_PRICE = 3500;
export const PROMO_QUARTERLY_PRICE = 5700;
export const PROMO_QUARTERLY_MONTHLY_EQUIVALENT = Math.round(PROMO_QUARTERLY_PRICE / 3); // 1,900원
export const PROMO_ANNUAL_PRICE = 22800;
export const PROMO_ANNUAL_MONTHLY_EQUIVALENT = Math.round(PROMO_ANNUAL_PRICE / 12); // 1,900원
export const PROMO_LABEL = "10월 오픈 기념 특별가";
export const PROMO_PERIOD_LABEL = "프로모션 기간: 2026년 10월 1일 ~ 10월 31일";

// KST(UTC+9) 기준 2026-10-01 00:00:00 ~ 2026-11-01 00:00:00(=10/31 23:59:59.999까지 포함).
const PROMO_START = new Date("2026-10-01T00:00:00+09:00");
const PROMO_END = new Date("2026-11-01T00:00:00+09:00");

export function isPromoActive(now: Date = new Date()): boolean {
  return now >= PROMO_START && now < PROMO_END;
}

// 실제로 결제될(또는 화면에 보여줄) 금액. 프로모션 기간이 아니면 평소 정가.
// null = 지금은 살 수 없는 이용권(3개월권은 프로모션 기간에만 있다) — 체크아웃이 이걸로 막는다.
export function currentPrice(plan: PlanId, now: Date = new Date()): number | null {
  const promo = isPromoActive(now);
  if (plan === "quarterly") return promo ? PROMO_QUARTERLY_PRICE : null;
  if (!promo) return PLAN_PRICES[plan];
  return plan === "monthly" ? PROMO_MONTHLY_PRICE : PROMO_ANNUAL_PRICE;
}
