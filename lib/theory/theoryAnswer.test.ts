import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildSelectPrompt, parseTheoryAnswer } from "./theoryAnswer.ts";

describe("parseTheoryAnswer", () => {
  const ids = ["ACT", "CFT", "DBT", "CBT"];
  test("약어·접두어·소문자·마침표를 허용하고, 목록 밖이나 NONE은 null", () => {
    assert.equal(parseTheoryAnswer("ACT", ids), "ACT");
    assert.equal(parseTheoryAnswer("TH-CFT", ids), "CFT");
    assert.equal(parseTheoryAnswer("dbt.", ids), "DBT");
    assert.equal(parseTheoryAnswer("NONE", ids), null);
    assert.equal(parseTheoryAnswer("none", ids), null);
    assert.equal(parseTheoryAnswer("", ids), null);
    assert.equal(parseTheoryAnswer("EFT", ids), null);
    assert.equal(parseTheoryAnswer("ACT이나 CFT", ids), null); // 여러 개를 말하면 고르지 않는다
  });
});

describe("buildSelectPrompt", () => {
  test("이론 약어·한 줄 설명·축을 나열하고 NONE을 허용한다", () => {
    const p = buildSelectPrompt([{ id: "ACT", focus: "생각과 싸우기보다 한 걸음", axes: "열림 / 중심잡힘" }, { id: "CFT", focus: "다정한 시선", axes: null }]);
    assert.match(p, /ACT: 생각과 싸우기보다 한 걸음 \[축: 열림 \/ 중심잡힘\]/);
    assert.match(p, /CFT: 다정한 시선\n?/);
    assert.match(p, /NONE/);
  });
});
