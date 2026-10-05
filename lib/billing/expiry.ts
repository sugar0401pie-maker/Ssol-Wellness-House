import type { PlanId } from "./pricing.ts";

// 이용권 종류별 만료일 계산 — 결제 승인 성공 시점(now) 기준. 달력 기준(월/연 단위)이라 "30일"이 아니라
// 다음 달 같은 날짜가 만료일이다. 순수 함수라 네트워크 없이 테스트한다(expiry.test.ts).
// 2026-10-05: 3개월권(quarterly) 추가 — 결제 시점 + 3개월.
export function computeExpiryFor(plan: PlanId, now: Date): Date {
  const expires = new Date(now);
  if (plan === "monthly") expires.setMonth(expires.getMonth() + 1);
  else if (plan === "quarterly") expires.setMonth(expires.getMonth() + 3);
  else expires.setFullYear(expires.getFullYear() + 1);
  return expires;
}
