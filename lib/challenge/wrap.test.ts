import { test } from "node:test";
import assert from "node:assert/strict";
import { wrapLines } from "./card.ts";

const m = (s: string) => [...s].length * 10; // 글자당 10

test("카드 글자 줄바꿈: 띄어쓰기 단위, 긴 낱말은 글자 단위, 넘치면 …", () => {
  assert.deepEqual(wrapLines(m, "오늘 하늘이 참 예뻤다", 60, 2), ["오늘 하늘이", "참 예뻤다"]);
  assert.deepEqual(wrapLines(m, "가나다라마바사아자차", 50, 3), ["가나다라마", "바사아자차"]);
  const r = wrapLines(m, "가나다라마바사아자차카타파하", 50, 2);
  assert.equal(r.length, 2);
  assert.ok(r[1].endsWith("…") && m(r[1]) <= 50);
});
