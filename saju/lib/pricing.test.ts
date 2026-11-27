import { test } from "node:test";
import assert from "node:assert/strict";
import { priceAt } from "./pricing.ts";

const P = { list_price: 1900, sale_price: 990, sale_badge: "12월 한정 할인가", sale_until: "2026-12-31T23:59:59+09:00" };

test("12월 31일 밤 11시 59분(한국 시간)까지는 할인가", () => {
  const r = priceAt(P, new Date("2026-12-31T23:59:00+09:00"));
  assert.equal(r.price, 990);
  assert.equal(r.onSale, true);
  assert.equal(r.priceText, "990원");
  assert.equal(r.badge, "12월 한정 할인가");
});

test("2027년 1월 1일 0시(한국 시간)부터 정가, 할인 표시 없음", () => {
  const r = priceAt(P, new Date("2027-01-01T00:00:00+09:00"));
  assert.equal(r.price, 1900);
  assert.equal(r.onSale, false);
  assert.equal(r.badge, null);
  assert.equal(r.priceText, "1,900원");
});
