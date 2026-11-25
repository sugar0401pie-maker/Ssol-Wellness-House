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
