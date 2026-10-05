import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  PROMO_ANNUAL_PRICE,
  PROMO_MONTHLY_PRICE,
  PROMO_QUARTERLY_MONTHLY_EQUIVALENT,
  PROMO_QUARTERLY_PRICE,
  currentPrice,
  isPlanId,
  isPromoActive,
} from "./pricing.ts";
import { computeExpiryFor } from "./expiry.ts";

// 가격은 실제 청구 금액이라 값 자체를 테스트로 고정한다 — 실수로 바뀌면 바로 알 수 있도록.
const IN_PROMO = new Date("2026-10-15T12:00:00+09:00");
const BEFORE_PROMO = new Date("2026-09-30T23:59:59+09:00");
const AFTER_PROMO = new Date("2026-11-01T00:00:00+09:00");

describe("프로모션 기간(KST 10/1 00:00 ~ 10/31 23:59:59)", () => {
  test("경계: 9/30 23:59:59는 아직 아니고, 10/1 00:00부터 시작, 10/31 23:59:59까지, 11/1 00:00부터 끝", () => {
    assert.equal(isPromoActive(BEFORE_PROMO), false);
    assert.equal(isPromoActive(new Date("2026-10-01T00:00:00+09:00")), true);
    assert.equal(isPromoActive(new Date("2026-10-31T23:59:59+09:00")), true);
    assert.equal(isPromoActive(AFTER_PROMO), false);
  });
});

describe("currentPrice — 실제 청구 금액", () => {
  test("프로모션 중: 3개월권 5,700원 / 1개월권 3,500원 / 연간 22,800원", () => {
    assert.equal(currentPrice("quarterly", IN_PROMO), 5700);
    assert.equal(currentPrice("monthly", IN_PROMO), 3500);
    assert.equal(currentPrice("annual", IN_PROMO), 22800);
  });

  test("3개월권의 '월 1,900원' 표시와 실제 청구(5,700원)가 정확히 맞는다 — 월 환산 x 3 = 청구액", () => {
    assert.equal(PROMO_QUARTERLY_MONTHLY_EQUIVALENT, 1900);
    assert.equal(PROMO_QUARTERLY_MONTHLY_EQUIVALENT * 3, PROMO_QUARTERLY_PRICE);
    assert.equal(PROMO_QUARTERLY_PRICE, currentPrice("quarterly", IN_PROMO));
  });

  test("상수와 currentPrice가 같은 값을 가리킨다(화면 표시와 체크아웃이 어긋나지 않게)", () => {
    assert.equal(PROMO_MONTHLY_PRICE, currentPrice("monthly", IN_PROMO));
    assert.equal(PROMO_ANNUAL_PRICE, currentPrice("annual", IN_PROMO));
  });

  test("프로모션 전·후: 월간 7,900원 / 연간 60,000원 정가로 돌아간다", () => {
    for (const d of [BEFORE_PROMO, AFTER_PROMO]) {
      assert.equal(currentPrice("monthly", d), 7900);
      assert.equal(currentPrice("annual", d), 60000);
    }
  });

  test("3개월권은 프로모션 기간이 아니면 살 수 없다(null) — 체크아웃이 이 값으로 주문을 막는다", () => {
    assert.equal(currentPrice("quarterly", BEFORE_PROMO), null);
    assert.equal(currentPrice("quarterly", AFTER_PROMO), null);
  });
});

describe("isPlanId", () => {
  test("알려진 세 가지만 통과시킨다", () => {
    assert.equal(isPlanId("monthly"), true);
    assert.equal(isPlanId("quarterly"), true);
    assert.equal(isPlanId("annual"), true);
    assert.equal(isPlanId("offline_package"), false); // 수동 부여용 — 결제 경로로 오면 안 된다
    assert.equal(isPlanId("weekly"), false);
    assert.equal(isPlanId(undefined), false);
  });
});

describe("computeExpiryFor — 만료일", () => {
  const now = new Date("2026-10-05T10:00:00Z");

  test("1개월권은 한 달 뒤, 3개월권은 3개월 뒤, 연간은 1년 뒤", () => {
    assert.equal(computeExpiryFor("monthly", now).toISOString(), "2026-11-05T10:00:00.000Z");
    assert.equal(computeExpiryFor("quarterly", now).toISOString(), "2027-01-05T10:00:00.000Z");
    assert.equal(computeExpiryFor("annual", now).toISOString(), "2027-10-05T10:00:00.000Z");
  });

  test("원래 날짜(now) 객체를 바꾸지 않는다", () => {
    const before = now.toISOString();
    computeExpiryFor("quarterly", now);
    assert.equal(now.toISOString(), before);
  });
});
