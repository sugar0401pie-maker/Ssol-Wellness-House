import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_THEORY_WEIGHT, parseTheoryWeight, weightTheoryPractices } from "./dailyWeight.ts";

const mk = (n: number, theory: boolean) => Array.from({ length: n }, (_, i) => ({ id: `${theory ? "T" : "G"}${i}`, sourceTheoryId: theory ? "TH-ACT" : null }));

describe("weightTheoryPractices", () => {
  test("weight=1이면 이전과 똑같다(같은 배열)", () => {
    const pool = [...mk(3, true), ...mk(5, false)];
    assert.equal(weightTheoryPractices(pool, 1), pool);
  });
  test("이론 기반만 weight번씩 늘어난다 — 197/505(약 39%) 후보가 2배면 약 56%", () => {
    const pool = [...mk(197, true), ...mk(308, false)];
    const w = weightTheoryPractices(pool, 2);
    assert.equal(w.length, 197 * 2 + 308);
    const share = w.filter((p) => p.sourceTheoryId).length / w.length;
    assert.ok(share > 0.55 && share < 0.57, `비중 ${share}`);
  });
  test("후보가 한쪽뿐이면 비율은 그대로이고 비어 있으면 비어 있다", () => {
    assert.equal(weightTheoryPractices(mk(4, false), 3).length, 4);
    assert.equal(weightTheoryPractices([], 3).length, 0);
  });
  test("날짜·사용자 해시로 고르는 결과가 실제로 이론 기반 쪽으로 기운다", () => {
    const pool = weightTheoryPractices([...mk(197, true), ...mk(308, false)], 2);
    let theory = 0;
    for (let i = 0; i < 2000; i++) { if (pool[(i * 2654435761) % pool.length >>> 0].sourceTheoryId) theory++; }
    assert.ok(theory / 2000 > 0.5, `뽑힌 비중 ${theory / 2000}`);
  });
});

describe("parseTheoryWeight", () => {
  test("없거나 이상하면 기본값, 범위는 1~5로 제한", () => {
    assert.equal(parseTheoryWeight(undefined), DEFAULT_THEORY_WEIGHT);
    assert.equal(parseTheoryWeight("abc"), DEFAULT_THEORY_WEIGHT);
    assert.equal(parseTheoryWeight("0"), 1);
    assert.equal(parseTheoryWeight("3"), 3);
    assert.equal(parseTheoryWeight("99"), 5);
  });
});
