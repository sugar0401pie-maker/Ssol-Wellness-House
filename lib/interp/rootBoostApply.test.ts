import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRootBoost, ROOT_BOOST_WEIGHT } from "./rootBoostApply.ts";

const rows = [{ id: "A", score: 1 }, { id: "B", score: 2 }, { id: "C", score: 0 }];

test("함수가 없으면 그대로", () => assert.deepEqual(applyRootBoost(rows, null), rows));

test("가산은 점수에 더하고, 제외는 목록에서 뺀다", () => {
  const r = applyRootBoost(rows, (id) => (id === "A" ? { boost: 2, exclude: false } : id === "B" ? { boost: 0, exclude: true } : { boost: 0, exclude: false }));
  assert.deepEqual(r, [{ id: "A", score: 1 + 2 * ROOT_BOOST_WEIGHT }, { id: "C", score: 0 }]);
});

test("원본을 바꾸지 않는다", () => {
  const before = JSON.stringify(rows);
  applyRootBoost(rows, () => ({ boost: 1, exclude: false }));
  assert.equal(JSON.stringify(rows), before);
});

test("전부 제외되면 가산 전 목록으로 되돌린다", () => {
  assert.deepEqual(applyRootBoost(rows, () => ({ boost: 0, exclude: true })), rows);
});
