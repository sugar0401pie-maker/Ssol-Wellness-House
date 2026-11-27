import { test } from "node:test";
import assert from "node:assert/strict";
import {
  keyAt, parsePageNo, isDecisionAnswer, pickFeed, fillJosa, salKo, splitBold, boldFirstSentence,
  boldSentenceAt, dots, ganjiHanja, seededShuffle, endDot,
} from "./resultView.ts";

const ORDER = ["p1", "p2", "p3", "p3b", "p3c", "p7", "p4", "sal2", "sal3", "p5", "p8", "p8b", "p9", "p10"];

test("keyAt / parsePageNo", () => {
  assert.equal(keyAt(ORDER, 1), "p1");
  assert.equal(keyAt(ORDER, 7), "p4");
  assert.equal(keyAt(ORDER, 15), null);
  assert.equal(keyAt(ORDER, 0), null);
  assert.equal(parsePageNo("14"), 14);
  assert.equal(parsePageNo("04"), null);
  assert.equal(parsePageNo("1.5"), null);
  assert.equal(parsePageNo("abc"), null);
});

test("isDecisionAnswer", () => {
  assert.equal(isDecisionAnswer("선택형: 움직이기 좋은 달 vs 기다리기 좋은 달"), true);
  assert.equal(isDecisionAnswer("시기형"), true);
  assert.equal(isDecisionAnswer("방향형: …"), false);
  assert.equal(isDecisionAnswer(undefined), false);
});

test("pickFeed: deterministic, no repeats until exhausted, skips pages", () => {
  const files = ["a", "b", "c", "d", "e"];
  const a = pickFeed(ORDER, files, "id-1", ["p9", "p10"]);
  const b = pickFeed(ORDER, files, "id-1", ["p9", "p10"]);
  assert.deepEqual(a, b);
  assert.equal(a.p9, undefined);
  assert.equal(a.p10, undefined);
  const first5 = ORDER.slice(0, 5).map((k) => a[k]);
  assert.equal(new Set(first5).size, 5);
  const seq = ORDER.filter((k) => a[k]).map((k) => a[k]);
  for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1]);
  assert.deepEqual(pickFeed(ORDER, [], "x"), {});
});

test("seededShuffle keeps items", () => {
  assert.deepEqual(seededShuffle([1, 2, 3, 4], 7).sort(), [1, 2, 3, 4]);
});

test("fillJosa", () => {
  assert.equal(fillJosa("살은 {sal:이에요}.", { sal: "현침" }), "살은 현침이에요.");
  assert.equal(fillJosa("살은 {sal:이에요}.", { sal: "도화" }), "살은 도화예요.");
  assert.equal(fillJosa("{x:을} {nickname}", { x: "일" }), "일을 {nickname}");
});

test("salKo", () => {
  assert.equal(salKo("현침"), "현침살");
  assert.equal(salKo("태극귀인"), "태극귀인");
  assert.equal(salKo("정록"), "정록");
  assert.equal(salKo("겁살"), "겁살");
});

test("splitBold / boldFirstSentence", () => {
  assert.deepEqual(splitBold("**a** b"), [{ text: "a", bold: true }, { text: " b", bold: false }]);
  assert.deepEqual(splitBold("a ** b"), [{ text: "a ** b", bold: false }]);
  assert.equal(boldFirstSentence("하나예요. 둘이에요."), "**하나예요.** 둘이에요.");
  assert.equal(boldFirstSentence("**이미** 굵음."), "**이미** 굵음.");
  assert.equal(boldFirstSentence("마침표 없음"), "**마침표 없음**");
  assert.equal(boldSentenceAt("하나. 둘. 셋.", 1), "하나. **둘.** 셋.");
});

test("dots / ganjiHanja / endDot", () => {
  assert.equal(dots(3), "●●●○○");
  assert.equal(ganjiHanja("신축"), "辛丑");
  assert.equal(ganjiHanja("무진"), "戊辰");
  assert.equal(endDot("끝"), "끝.");
  assert.equal(endDot("끝."), "끝.");
});
