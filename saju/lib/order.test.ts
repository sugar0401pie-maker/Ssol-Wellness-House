import { test } from "node:test";
import assert from "node:assert/strict";
import { makeOrderId, resultIdOfOrder, partnerUserOf } from "./order.ts";

const ID = "3f2b7c1e-1111-4222-8333-944455556666";

test("주문 번호는 6~64자·허용 문자만이고 결과 번호를 다시 꺼낼 수 있다", () => {
  const o = makeOrderId(ID, "Ab12Cd34");
  assert.ok(o.length >= 6 && o.length <= 64);
  assert.match(o, /^[A-Za-z0-9_=-]+$/);
  assert.equal(resultIdOfOrder(o), ID);
});

test("이상한 주문 번호는 결과 번호로 읽지 않는다", () => {
  assert.equal(resultIdOfOrder("hello_world"), null);
  assert.equal(resultIdOfOrder(`${ID}_ab/../x`), null);
  assert.equal(resultIdOfOrder(null), null);
  assert.throws(() => makeOrderId("not-a-uuid", "abcd1234"));
});

test("partner_user_id는 결과 번호로 만든다", () => {
  const k = partnerUserOf(ID);
  assert.ok(k.length >= 22);
  assert.match(k, /[-_=.@]/);
});
