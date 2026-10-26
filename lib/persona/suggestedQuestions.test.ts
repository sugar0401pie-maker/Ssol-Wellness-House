import { test } from "node:test";
import assert from "node:assert/strict";
import { EVERYDAY_QUESTION_GROUPS, SUGGESTED_QUESTION_GROUPS, pickRandomSuggestedQuestions } from "./suggestedQuestions.ts";

test("일상 고민 시작 문구: id·문장이 겹치지 않고, 성향 질문과도 다르다", () => {
  const e = EVERYDAY_QUESTION_GROUPS.flatMap((g) => g.questions), p = SUGGESTED_QUESTION_GROUPS.flatMap((g) => g.questions);
  assert.equal(new Set(e.map((q) => q.id)).size, e.length);
  assert.equal(new Set(e.map((q) => q.text)).size, e.length);
  assert.ok(e.every((q) => !p.some((x) => x.text === q.text || x.id === q.id)));
});

test("일상 문구에는 진단·위기·폭력으로 읽힐 말이 없다(안전 라우터가 일반 대화로 받도록)", () => {
  const bad = /(자살|자해|죽|우울|공황|불안장애|폭력|때리|학대|약|진단|병원)/;
  for (const g of EVERYDAY_QUESTION_GROUPS) for (const q of g.questions) assert.ok(!bad.test(q.text), q.text);
});

test("무작위로 고르는 함수: 요청한 개수만큼, 중복 없이, 지정한 목록에서만", () => {
  const picked = pickRandomSuggestedQuestions(3, EVERYDAY_QUESTION_GROUPS);
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked.map((q) => q.id)).size, 3);
  assert.ok(picked.every((q) => q.id.startsWith("ed-")));
  assert.ok(pickRandomSuggestedQuestions(2).every((q) => !q.id.startsWith("ed-"))); // 기본값은 기존 성향 질문
});
