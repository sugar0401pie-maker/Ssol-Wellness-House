import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { THINKING_INTERVAL_MS, THINKING_WORDS, thinkingWordAt } from "./thinkingWords.ts";

describe("thinkingWords", () => {
  test("처음에는 기존 문구 '생각하는 중'이 보이고, 3초 간격이다", () => {
    assert.equal(thinkingWordAt(0), "생각하는 중");
    assert.equal(THINKING_INTERVAL_MS, 3000);
  });
  test("순서대로 돌고, 끝에 닿으면 처음으로 돌아간다(음수·소수도 안전)", () => {
    assert.equal(thinkingWordAt(1), THINKING_WORDS[1]);
    assert.equal(thinkingWordAt(THINKING_WORDS.length), THINKING_WORDS[0]);
    assert.equal(thinkingWordAt(THINKING_WORDS.length * 5 + 2), THINKING_WORDS[2]);
    assert.equal(thinkingWordAt(-1), THINKING_WORDS[THINKING_WORDS.length - 1]);
    assert.equal(thinkingWordAt(1.9), THINKING_WORDS[1]);
  });
  test("문구는 서로 다르고, 일반 글자만 쓰고, 진단·치료를 암시하는 말이 없다", () => {
    assert.equal(new Set(THINKING_WORDS).size, THINKING_WORDS.length);
    for (const w of THINKING_WORDS) {
      assert.ok(w.trim().length > 0 && w.length <= 20, w);
      assert.doesNotMatch(w, /[*_#`>\-]/, `마크다운 기호: ${w}`);
      assert.doesNotMatch(w, /진단|치료|처방|검사|분석/, `의료·판정 암시: ${w}`);
    }
  });
});
