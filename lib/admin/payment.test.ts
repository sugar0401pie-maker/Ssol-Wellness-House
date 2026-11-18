import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { paymentProviderOf, summarizePayment } from "./payment.ts";

const now = new Date("2026-11-18T03:00:00Z");
const ent = (o: Partial<Parameters<typeof summarizePayment>[0][number]>) => ({ plan: "monthly", status: "active", amount: 2900, expires_at: "2026-12-18T00:00:00Z", toss_payment_key: "pk", ...o });

describe("계정 결제 요약", () => {
  test("아무것도 없으면 결제 없음", () => {
    const s = summarizePayment([], [], now);
    assert.equal(s.paid, false);
    assert.equal(s.label, "결제 없음");
  });
  test("신청만 한 이용권(pending)은 결제가 아니다", () => {
    const s = summarizePayment([ent({ status: "pending", toss_payment_key: null })], [], now);
    assert.equal(s.paid, false);
    assert.equal(s.pending, 1);
    assert.equal(s.label, "결제 대기(신청만) 1건");
  });
  test("토스 결제 + 지금 이용 중", () => {
    const s = summarizePayment([ent({})], [], now);
    assert.equal(s.paid, true);
    assert.equal(s.activeNow, true);
    assert.equal(s.label, "이용권 결제 1건(1개월, 토스 1, 2,900원) · 지금 이용 중(~2026-12-18)");
  });
  test("만료된 이용권은 결제로 세되 '이용권 만료'로 표시", () => {
    const s = summarizePayment([ent({ status: "expired", expires_at: "2026-10-01T00:00:00Z" })], [], now);
    assert.equal(s.paid, true);
    assert.equal(s.activeNow, false);
    assert.ok(s.label.endsWith("이용권 만료"));
  });
  test("active인데 만료일이 지났으면 이용 중이 아니다", () => {
    assert.equal(summarizePayment([ent({ expires_at: "2026-11-01T00:00:00Z" })], [], now).activeNow, false);
  });
  test("수동 승인·기한 없음(무기한 부여)", () => {
    const s = summarizePayment([ent({ plan: "annual", toss_payment_key: null, expires_at: null, amount: null })], [], now);
    assert.equal(s.passManual, 1);
    assert.equal(s.unlimited, true);
    assert.ok(s.label.includes("수동 1") && s.label.includes("지금 이용 중(기한 없음)"));
  });
  test("심층 보고서는 paid만 센다", () => {
    const s = summarizePayment([], [{ status: "paid", amount: 9900 }, { status: "pending", amount: 9900 }, { status: "failed", amount: 9900 }], now);
    assert.equal(s.paid, true);
    assert.equal(s.reportPaid, 1);
    assert.equal(s.label, "심층 보고서 구매 1건(9,900원)");
  });
  test("여러 개가 함께 있을 때 한 줄로", () => {
    const s = summarizePayment([ent({}), ent({ plan: "annual", toss_payment_key: null, amount: 22800, expires_at: "2027-11-18T00:00:00Z" })], [{ status: "paid", amount: 9900 }], now);
    assert.equal(s.label, "이용권 결제 2건(1개월·연간, 토스 1 · 수동 1, 25,700원) · 지금 이용 중(~2027-11-18) · 심층 보고서 구매 1건(9,900원)");
  });
});

describe("결제 수단 구분(카카오페이 2026-11-18)", () => {
  test("카카오페이 행은 카카오페이로, 예전 행은 토스 키 유무로", () => {
    assert.equal(paymentProviderOf({ toss_payment_key: null, payment_provider: "kakaopay", kakaopay_aid: "A1" }), "kakaopay");
    assert.equal(paymentProviderOf({ toss_payment_key: null, kakaopay_aid: "A1" }), "kakaopay");
    assert.equal(paymentProviderOf({ toss_payment_key: "pk" }), "toss");
    assert.equal(paymentProviderOf({ toss_payment_key: null }), "manual");
    assert.equal(paymentProviderOf({ toss_payment_key: null, payment_provider: "toss" }), "toss");
  });
  test("요약 문구에 카카오페이가 따로 나온다", () => {
    const s = summarizePayment([ent({ toss_payment_key: null, payment_provider: "kakaopay", kakaopay_aid: "A1" })], [], now);
    assert.equal(s.passKakaopay, 1);
    assert.equal(s.passManual, 0);
    assert.ok(s.label.startsWith("이용권 결제 1건(1개월, 카카오페이 1, 2,900원)"));
  });
});
