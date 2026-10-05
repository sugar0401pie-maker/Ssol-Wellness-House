import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { pickTheoryCandidate, DEFAULT_MATCHER_CONFIG, type TheoryHit } from "./matcher.ts";

const cfg = { ...DEFAULT_MATCHER_CONFIG, minScore: 0.5, margin: 0.05, minHits: 2 };
const hit = (theoryId: string, questionId: string, similarity: number): TheoryHit => ({ theoryId, questionId, similarity });

describe("pickTheoryCandidate", () => {
  test("검색 결과가 없으면 후보 없음(null)", () => {
    assert.equal(pickTheoryCandidate([], cfg), null);
  });

  test("한 이론의 질문이 충분히 많이, 충분히 비슷하게 걸리면 그 이론이 후보가 된다", () => {
    const r = pickTheoryCandidate([hit("TH-1", "Q1", 0.7), hit("TH-1", "Q2", 0.6), hit("TH-2", "Q9", 0.3)], cfg);
    assert.equal(r?.theoryId, "TH-1");
    assert.deepEqual(r?.hitQuestionIds, ["Q1", "Q2"]); // 유사도 높은 순
  });

  test("걸린 질문이 minHits보다 적으면 우연한 한 건으로 보고 후보로 인정하지 않는다", () => {
    assert.equal(pickTheoryCandidate([hit("TH-1", "Q1", 0.95)], cfg), null);
  });

  test("점수가 minScore에 못 미치면 null", () => {
    assert.equal(pickTheoryCandidate([hit("TH-1", "Q1", 0.4), hit("TH-1", "Q2", 0.4)], cfg), null);
  });

  test("1등과 2등 이론의 차이가 margin보다 작으면(비슷한 질문이 겹침) 억지로 고르지 않고 null", () => {
    const hits = [hit("TH-1", "Q1", 0.7), hit("TH-1", "Q2", 0.7), hit("TH-2", "Q8", 0.68), hit("TH-2", "Q9", 0.68)];
    assert.equal(pickTheoryCandidate(hits, cfg), null);
  });

  test("차이가 margin 이상이면 1등이 후보가 된다", () => {
    const hits = [hit("TH-1", "Q1", 0.8), hit("TH-1", "Q2", 0.8), hit("TH-2", "Q8", 0.6), hit("TH-2", "Q9", 0.6)];
    assert.equal(pickTheoryCandidate(hits, cfg)?.theoryId, "TH-1");
  });

  test("점수는 이론당 상위 topPerTheory개 유사도의 평균이다", () => {
    const r = pickTheoryCandidate(
      [hit("TH-1", "Q1", 0.9), hit("TH-1", "Q2", 0.8), hit("TH-1", "Q3", 0.7), hit("TH-1", "Q4", 0.1)],
      { ...cfg, topPerTheory: 3 },
    );
    assert.ok(r);
    assert.ok(Math.abs(r.score - 0.8) < 1e-9);
  });

  test("유사도가 숫자가 아닌 이상한 값은 무시한다", () => {
    const r = pickTheoryCandidate([hit("TH-1", "Q1", Number.NaN), hit("TH-1", "Q2", 0.9), hit("TH-1", "Q3", 0.8)], cfg);
    assert.equal(r?.theoryId, "TH-1");
    assert.deepEqual(r?.hitQuestionIds, ["Q2", "Q3"]);
  });
});
