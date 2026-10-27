import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBands, buildCues, buildDomains, buildPairs, buildTestInput, forInstrument, INSTRUMENT, TEST_DOMAINS, TEST_PAIRS } from "./testInput.ts";

test("문자열 JSON·객체 모두 받고 type_key를 영역과 대처 방식으로 나눈다", () => {
  const t = buildTestInput({ id: "r1", type_key: "SLF-primary", created_at: "2026-10-15T00:00:00Z", factor_scores: '{"values":4.5,"job_fit":2.5}', sub_scores: { support: 4.5, reframing: 5 } });
  assert.deepEqual(t, { instrument: "dessert_v2", test_id: "r1", factorScores: { values: 4.5, job_fit: 2.5 }, main_domain: "SLF", coping: "primary", copingSub: { support: 4.5, reframing: 5 }, at: "2026-10-15T00:00:00Z" });
});

test("요인 점수가 없거나 범위 밖이면 단서를 만들지 않는다(TRR-20)", () => {
  assert.equal(buildTestInput(null), null);
  assert.equal(buildTestInput({ id: "x", factor_scores: null }), null);
  assert.equal(buildTestInput({ id: "x", factor_scores: "깨진 값" }), null);
  assert.equal(buildTestInput({ id: "x", factor_scores: { a: 9, b: "3", c: 0 } }), null);
  assert.equal(buildTestInput({ factor_scores: { a: 3 } }), null);
});

test("단서·구간 행 변환: 깨진 행은 건너뛰고 구간은 낮은 쪽부터", () => {
  const cues = buildCues([
    { cue_id: "TR-1", source: "band", cond_json: '{"band":["VL"],"factor":"job_fit"}', root_id: "ROOT-05", points: "1.5", direction: "cue", entry_hyps: "H1, H2" },
    { cue_id: "TR-2", source: "band", cond_json: "깨짐", root_id: "ROOT-05", points: 1, direction: "cue", entry_hyps: null },
    { cue_id: "TR-3", source: "band", cond_json: {}, root_id: null, points: 1, direction: "cue", entry_hyps: null },
  ]);
  assert.equal(cues.length, 1);
  assert.deepEqual(cues[0].entry_hyps, ["H1", "H2"]);
  assert.equal(cues[0].points, 1.5);
  assert.deepEqual(buildBands([{ band: "H", lo: 4, hi: "4.5" }, { band: "VL", lo: 1, hi: 2 }]).map((b) => b[0]), ["VL", "H"]);
  assert.deepEqual(Object.keys(TEST_DOMAINS), ["CAR", "LOV", "REL", "SLF", "DIR"]);
});

test("검사별 표(DB v1.9): instrument 칸이 없으면 디저트 테스트로 본다 · 다른 검사는 걸러낸다", () => {
  assert.equal(INSTRUMENT, "dessert_v2");
  assert.deepEqual(forInstrument([{ instrument: "dessert_v2", a: 1 }, { instrument: "other", a: 2 }, { a: 3 }]).map((r) => (r as { a: number }).a), [1, 3]);
});

test("영역·짝 표 변환은 우리 상수와 같은 모양이 나온다", () => {
  const dom = buildDomains([{ domain: "DIR", factor: "meaning", ord: "2" }, { domain: "DIR", factor: "values", ord: "1" }, { domain: "CAR", factor: "job_fit", ord: 1 }]);
  assert.deepEqual(dom, { CAR: ["job_fit"], DIR: ["values", "meaning"] });
  assert.deepEqual(dom.DIR, TEST_DOMAINS.DIR);
  assert.deepEqual(buildPairs([{ root_a: "ROOT-77", root_b: "ROOT-81" }]), [TEST_PAIRS[0]]);
});

test("TRR-22: 온보딩 답(context)은 있을 때만 시험 입력에 붙는다", () => {
  const row = { id: "r1", factor_scores: { A: 1 }, sub_scores: {}, type_key: "LOV-primary", created_at: "2026-10-27T00:00:00Z" };
  assert.deepEqual(buildTestInput(row, { relationship_status: "has_partner" })?.context, { relationship_status: "has_partner" });
  assert.equal(buildTestInput(row)?.context, undefined);
  assert.equal(buildTestInput(row, {})?.context, undefined);
});
