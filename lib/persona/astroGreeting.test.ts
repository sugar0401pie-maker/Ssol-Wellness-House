import { test } from "node:test";
import assert from "node:assert/strict";
import { astroOpeningFromSearch, extractAstroGreeting, parseAstroOpening } from "./astroGreeting.ts";

const ID = "11111111-1111-4111-8111-111111111111";

test("chat_summary 끝 줄에서 첫 인사 문장만 꺼낸다", () => {
  const s = `[1. 별이 본 나의 유형] 태양 양자리.\n[9. 대화 시작 정보] 정확도 A등급. 부드러운 톤: 아니요. 첫 인사: GREET_DEFAULT. 첫 인사 문장: 지우님, 반가워요! 🌙 별 리포트 잘 읽어 봤어요.`;
  assert.equal(extractAstroGreeting(s), "지우님, 반가워요! 🌙 별 리포트 잘 읽어 봤어요.");
});

test("문장이 없거나 형식이 다르면 null(기본 인사로)", () => {
  assert.equal(extractAstroGreeting("[9. 대화 시작 정보] 정확도 A등급. 첫 인사: GREET_DEFAULT."), null);
  assert.equal(extractAstroGreeting(null), null);
  assert.equal(extractAstroGreeting("첫 인사 문장: 본문 줄에 있으면 안 됨"), null);
  assert.equal(extractAstroGreeting(`[9. 대화 시작 정보] 첫 인사 문장: ${"가".repeat(500)}`), null);
});

test("주소·요청 본문의 점성술 진입 표시", () => {
  assert.deepEqual(astroOpeningFromSearch(`?from=astro&result=${ID}`), { resultId: ID });
  assert.deepEqual(astroOpeningFromSearch("?from=astro&result=../../etc"), { resultId: null });
  assert.equal(astroOpeningFromSearch("?from=quiz"), null);
  assert.deepEqual(parseAstroOpening({ from: "astro", resultId: ID }), { resultId: ID });
  assert.deepEqual(parseAstroOpening({ from: "astro", resultId: 3 }), { resultId: null });
  assert.equal(parseAstroOpening({ from: "x" }), null);
  assert.equal(parseAstroOpening("astro"), null);
});
