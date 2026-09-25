import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { toggleRank, rankOf, toRankedAnswers } from "./rankSelect.ts";
import { isOtherTextValid, nonWhitespaceCount } from "./schema.ts";

describe("toggleRank", () => {
  test("A, B, C 순서로 고르면 순위대로 쌓인다", () => {
    let sel: string[] = [];
    sel = toggleRank(sel, "A", { maxRank: 3 });
    sel = toggleRank(sel, "B", { maxRank: 3 });
    sel = toggleRank(sel, "C", { maxRank: 3 });
    assert.deepEqual(sel, ["A", "B", "C"]);
    assert.equal(rankOf(sel, "A"), 1);
    assert.equal(rankOf(sel, "B"), 2);
    assert.equal(rankOf(sel, "C"), 3);
  });

  test("B를 해제하면 뒤 순위가 즉시 당겨진다 (스펙 QA-03)", () => {
    let sel = ["A", "B", "C"];
    sel = toggleRank(sel, "B", { maxRank: 3 });
    assert.deepEqual(sel, ["A", "C"]);
    assert.equal(rankOf(sel, "A"), 1);
    assert.equal(rankOf(sel, "C"), 2);
  });

  test("2개 남았을 때 D를 새로 고르면 3순위로 붙는다", () => {
    const sel = toggleRank(["A", "C"], "D", { maxRank: 3 });
    assert.deepEqual(sel, ["A", "C", "D"]);
  });

  test("이미 3개면 4번째는 무시된다(최대 개수 안내는 UI 담당)", () => {
    const sel = toggleRank(["A", "B", "C"], "D", { maxRank: 3 });
    assert.deepEqual(sel, ["A", "B", "C"]);
  });

  test("배타 옵션을 고르면 기존 선택이 모두 지워지고 그것만 남는다", () => {
    const sel = toggleRank(["A", "B"], "no_hobby_yet", { maxRank: 3, exclusiveCodes: ["no_hobby_yet"] });
    assert.deepEqual(sel, ["no_hobby_yet"]);
  });

  test("배타 옵션이 선택된 상태에서 일반 옵션을 고르면 배타 선택이 사라진다", () => {
    const sel = toggleRank(["no_hobby_yet"], "A", { maxRank: 3, exclusiveCodes: ["no_hobby_yet"] });
    assert.deepEqual(sel, ["A"]);
  });

  test("이미 선택된 항목을 다시 누르면 해제된다", () => {
    const sel = toggleRank(["A", "B"], "A", { maxRank: 3 });
    assert.deepEqual(sel, ["B"]);
  });
});

describe("toRankedAnswers", () => {
  test("기타에 입력한 텍스트가 함께 저장된다", () => {
    const out = toRankedAnswers(["career_success", "other"], "오랫동안 하고 싶었던 작업을 해보고 싶어요");
    assert.deepEqual(out, [
      { key: "career_success", rank: 1 },
      { key: "other", rank: 2, other_text: "오랫동안 하고 싶었던 작업을 해보고 싶어요" },
    ]);
  });
});

describe("isOtherTextValid (스펙 4.2 — 공백 제외 10자 이상, 200자 이하)", () => {
  test("공백만 10개는 실패한다", () => {
    assert.equal(isOtherTextValid("          "), false);
  });
  test("글자 9개 + 공백은 실패한다", () => {
    assert.equal(isOtherTextValid("123456789 "), false);
  });
  test("공백 제외 10자 이상이면 통과한다", () => {
    assert.equal(isOtherTextValid("가나다라마바사아자차"), true);
  });
  test("공백이 섞여도 공백 제외 글자 수만 센다", () => {
    assert.equal(isOtherTextValid("가 나 다 라 마 바 사 아 자 차"), true);
    assert.equal(nonWhitespaceCount("가 나 다 라 마 바 사 아 자 차"), 10);
  });
  test("200자를 넘으면 실패한다", () => {
    assert.equal(isOtherTextValid("가".repeat(201)), false);
  });
});
