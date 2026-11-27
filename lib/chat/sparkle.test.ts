import { test } from "node:test";
import assert from "node:assert/strict";
import { FAREWELL_SPARKLE_RULE, SPARKLES, pickSparkle, withSparkle } from "./sparkle.ts";

test("인사 첫 문단 끝에 별가루 하나", () => {
  assert.equal(withSparkle("안녕하세요. 반가워요.", "⋆˙⟡"), "안녕하세요. 반가워요. ⋆˙⟡");
  assert.equal(withSparkle("요약이에요.\n\n더 궁금한 고민이 있나요?", "⋆˙⟡"), "요약이에요. ⋆˙⟡\n\n더 궁금한 고민이 있나요?");
});

test("이미 별가루가 있으면 또 붙이지 않는다 · 빈 글은 그대로", () => {
  assert.equal(withSparkle("안녕하세요 ⋆˙⟡", "₊˚⊹⋆"), "안녕하세요 ⋆˙⟡");
  assert.equal(withSparkle("", "₊˚⊹⋆"), "");
});

test("같은 씨앗이면 같은 별가루, 목록 안에서만", () => {
  assert.equal(pickSparkle("a"), pickSparkle("a"));
  assert.ok((SPARKLES as readonly string[]).includes(pickSparkle("session-123")));
});

test("기호에 마크다운 별표·보이지 않는 글자가 없다", () => {
  for (const s of SPARKLES) {
    assert.doesNotMatch(s, /[*_`~]/);
    assert.doesNotMatch(s, /[​-‏‪-‮⁠؀-ۿ܀-ࣿ]/);
  }
  assert.match(FAREWELL_SPARKLE_RULE, /마무리 인사/);
});
