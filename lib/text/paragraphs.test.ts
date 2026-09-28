import { test } from "node:test";
import assert from "node:assert/strict";
import { splitSentences, groupIntoParagraphs } from "./paragraphs.ts";

test("splitSentences", () => {
  const text = "가치 명료성 5.00점입니다. 의미는 지금의 하루가 무엇과 이어지는지 느끼는 감각이에요. 정말 그런가요?";
  assert.deepEqual(splitSentences(text), [
    "가치 명료성 5.00점입니다.",
    "의미는 지금의 하루가 무엇과 이어지는지 느끼는 감각이에요.",
    "정말 그런가요?",
  ]);
});

test("splitSentences: 빈 문자열은 빈 배열", () => {
  assert.deepEqual(splitSentences(""), []);
  assert.deepEqual(splitSentences("   "), []);
});

test("groupIntoParagraphs: 기본 3문장씩 묶는다", () => {
  const text = "하나. 둘. 셋. 넷. 다섯.";
  assert.deepEqual(groupIntoParagraphs(text), ["하나. 둘. 셋.", "넷. 다섯."]);
});

test("groupIntoParagraphs: 문장이 3개 이하면 문단 1개", () => {
  assert.deepEqual(groupIntoParagraphs("하나. 둘."), ["하나. 둘."]);
});
