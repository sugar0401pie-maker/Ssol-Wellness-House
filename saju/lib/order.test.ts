import { test } from "node:test";
import assert from "node:assert/strict";
import { makeOrderId, resultIdOfOrder, customerKeyOf } from "./order.ts";

const ID = "3f2b7c1e-1111-4222-8333-944455556666";

test("주문 번호는 토스 규칙(6~64자, 허용 문자)에 맞고 결과 번호를 다시 꺼낼 수 있다", () => {
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

test("고객 키는 22자 이상이고 특수문자를 포함", () => {
  const k = customerKeyOf(ID);
  assert.ok(k.length >= 22);
  assert.match(k, /[-_=.@]/);
});
