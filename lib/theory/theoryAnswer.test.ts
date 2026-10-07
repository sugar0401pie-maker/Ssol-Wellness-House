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

import { applySelectSuffixes, SELECT_SUFFIXES } from "./selectHints.ts";
describe("구분 단서(selectHints)", () => {
  test("해당 이론 설명 줄 끝에만 단서가 붙고 다른 이론·원본 목록은 그대로다", () => {
    const t = [{ id: "EFT", focus: "a", axes: null }, { id: "CBT", focus: "b", axes: null }];
    const out = applySelectSuffixes(t);
    assert.equal(out[0].focus, `a ${SELECT_SUFFIXES.EFT}`);
    assert.equal(out[1].focus, "b");
    assert.equal(t[0].focus, "a"); // 원본을 바꾸지 않는다
  });
  test("단서를 붙인 프롬프트에도 이론 줄이 한 줄씩 그대로 들어간다", () => {
    const p = buildSelectPrompt(applySelectSuffixes([{ id: "IPT", focus: "역할", axes: "기대" }, { id: "LOGO", focus: "의미", axes: null }]));
    assert.match(p, /IPT: 역할 ※ 분담/);
    assert.match(p, /LOGO: 의미 ※ 무엇이 의미인지/);
  });
});
