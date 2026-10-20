import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHandoff } from "./astroInput.ts";

test("점성술 결과 행 → handoff: 답·유형·태양 별자리·정확도, type_chosen은 모르니 false", () => {
  const h = buildHandoff({ id: "r1", created_at: "2026-10-01T00:00:00Z", answers: { q1: "연애", q2: "변화", q3: "사랑" }, competency: "기대기", style: "다가가기", sun_sign: "황소자리", accuracy: "A" });
  assert.deepEqual(h, {
    source_id: "r1", created_at: "2026-10-01T00:00:00Z", answers: { q1_domain: "연애", q2_word_2026: "변화", q3_wish_2027: "사랑" },
    chart_summary: { sun: "황소자리", type: { competency: "기대기", style: "다가가기" } }, user: { accuracy: "A" }, type_chosen: false,
  });
});

test("JSON 문자열 답도 받고, 일부만 있어도 있는 것만 담는다", () => {
  const h = buildHandoff({ id: "r2", created_at: "2026-10-01T00:00:00Z", answers: '{"q1":"가족"}', competency: "믿기" });
  assert.deepEqual(h?.answers, { q1_domain: "가족", q2_word_2026: undefined, q3_wish_2027: undefined });
  assert.equal(h?.chart_summary.type, undefined); // 유형은 competency와 style이 둘 다 있을 때만
});

test("결과를 가리킬 id·시각이 없거나 쓸 내용이 하나도 없으면 만들지 않는다", () => {
  assert.equal(buildHandoff(null), null);
  assert.equal(buildHandoff({ created_at: "2026-10-01T00:00:00Z", answers: { q1: "연애" } }), null);
  assert.equal(buildHandoff({ id: "r3", created_at: "2026-10-01T00:00:00Z", answers: {} }), null);
});
