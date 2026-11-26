import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanOpening, testOpeningKey, testOpeningSourceFrom } from "./testOpeningSource.ts";

const ID = "123e4567-e89b-12d3-a456-426614174000";

test("테스트에서 들어온 주소만 첫 메시지 대상", () => {
  assert.deepEqual(testOpeningSourceFrom(`?from=tarot&result=${ID}`), { kind: "tarot", resultId: ID });
  assert.equal(testOpeningSourceFrom("?from=tarot&result=x"), null); // 타로는 결과 id가 있어야
  assert.deepEqual(testOpeningSourceFrom("?from=astro"), { kind: "astro", resultId: null });
  assert.deepEqual(testOpeningSourceFrom("?from=quiz"), { kind: "quiz" });
  assert.equal(testOpeningSourceFrom(""), null);
  assert.equal(testOpeningSourceFrom("?from=other"), null);
  assert.equal(testOpeningKey({ kind: "tarot", resultId: ID }), `tarot:${ID}`);
});

test("말풍선은 꾸밈 없는 글로", () => {
  const out = cleanOpening("## 반가워요\n**타로 결과**를 보고 오셨군요.\n- 첫째 카드는 이런 뜻이에요.\n\n\n\n더 궁금한 고민이 있나요?");
  assert.equal(out, "반가워요\n타로 결과를 보고 오셨군요.\n첫째 카드는 이런 뜻이에요.\n\n더 궁금한 고민이 있나요?");
  assert.equal(cleanOpening("짧아요"), null);
});

test("여러 테스트를 봤으면 가장 최근 테스트 기준", async () => {
  const { pickLatestTest } = await import("./testOpeningSource.ts");
  const ID2 = "223e4567-e89b-12d3-a456-426614174000";
  assert.equal(pickLatestTest([]), null);
  assert.equal(pickLatestTest([null, undefined]), null);
  const t = { kind: "tarot" as const, id: ID, at: "2026-11-20T10:00:00Z" };
  const a = { kind: "astro" as const, id: ID2, at: "2026-11-25T10:00:00Z" };
  const q = { kind: "quiz" as const, id: "q1", at: "2026-11-22T10:00:00Z" };
  assert.deepEqual(pickLatestTest([t, a, q]), { source: { kind: "astro", resultId: ID2 }, key: `astro:${ID2}` });
  assert.deepEqual(pickLatestTest([t, q]), { source: { kind: "quiz" }, key: "quiz:q1" });
  assert.deepEqual(pickLatestTest([t, { ...q, at: "날짜 아님" }]), { source: { kind: "tarot", resultId: ID }, key: `tarot:${ID}` });
});
