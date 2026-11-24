import { test } from "node:test";
import assert from "node:assert/strict";
import { reportPurchase } from "./googleAds.ts";

function fakeWindow() {
  const store = new Map<string, string>();
  const w = { dataLayer: [] as unknown[], sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } };
  (globalThis as unknown as { window: unknown }).window = w;
  return w;
}

test("결제 전환: 실제 금액·주문 번호로 한 번 보내고, 같은 주문은 다시 보내지 않는다", () => {
  const w = fakeWindow();
  assert.equal(reportPurchase({ value: 990, transactionId: "order-1" }), true);
  const ev = Array.from(w.dataLayer.at(-1) as ArrayLike<unknown>);
  assert.deepEqual(ev, ["event", "purchase", { value: 990, currency: "KRW", transaction_id: "order-1" }]);
  assert.equal(reportPurchase({ value: 990, transactionId: "order-1" }), false); // 새로고침
  assert.equal(reportPurchase({ value: 7900, transactionId: "order-2" }), true);
  assert.equal(reportPurchase({ value: 0, transactionId: "order-3" }), false); // 금액 없음
  assert.equal(reportPurchase({ value: 990, transactionId: "" }), false);
});
