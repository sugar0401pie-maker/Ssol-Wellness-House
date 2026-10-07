import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { composeCommitReply, composeExploreReply, stripQuestions } from "./compose.ts";

describe("stripQuestions", () => {
  test("물음표로 끝나는 문장만 지운다", () => {
    assert.equal(stripQuestions("많이 지치셨겠어요. 어떤 점이 가장 힘드세요?"), "많이 지치셨겠어요.");
    assert.equal(stripQuestions("그랬군요. 마음이 무거웠겠어요."), "그랬군요. 마음이 무거웠겠어요.");
    assert.equal(stripQuestions("무슨 일이 있었나요?"), "");
  });
});

describe("composeExploreReply — AI 앞부분 + DB 질문 원문", () => {
  test("앞부분 뒤에 질문을 그대로 붙인다(문단 구분)", () => {
    assert.equal(composeExploreReply("불안을 줄이려고 애쓰셨군요.", "그게 얼마나 도움이 됐나요?"), "불안을 줄이려고 애쓰셨군요.\n\n그게 얼마나 도움이 됐나요?");
  });
  test("AI가 질문을 섞어 써도 질문은 DB 것 하나만 남는다", () => {
    assert.equal(composeExploreReply("그랬군요. 언제부터였나요?", "지금 마음은 어때요?"), "그랬군요.\n\n지금 마음은 어때요?");
  });
  test("앞부분이 비면 질문만", () => {
    assert.equal(composeExploreReply("   ", "지금 마음은 어때요?"), "지금 마음은 어때요?");
  });
});

describe("composeCommitReply — 정리 + 실천(제안 이유 포함)", () => {
  test("실천 이름 아래 제안 이유 한 줄, 마크다운 기호 없음", () => {
    const r = composeCommitReply("오늘은 가장 작은 걸음 하나를 정해봤어요.", [
      { title: "가장 작은 시작 문장 적기", reason: "시작이 가장 무거울 때 첫 문장만 적어도 길이 열려요." },
      { title: "'걱정이 왔구나' 적어두기", reason: null },
    ]);
    assert.match(r, /^오늘은 가장 작은 걸음 하나를 정해봤어요\.\n\n지금 이야기에 맞춰 이런 걸 해볼 수 있어요\./);
    assert.match(r, /첫째, 가장 작은 시작 문장 적기\n시작이 가장 무거울 때/);
    assert.match(r, /둘째, '걱정이 왔구나' 적어두기$/);
    assert.doesNotMatch(r, /[*#]|\n- /);
  });
  test("실천이 없으면 정리 문장만", () => {
    assert.equal(composeCommitReply("오늘은 여기까지 정리해봤어요.", []), "오늘은 여기까지 정리해봤어요.");
  });
});
