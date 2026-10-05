import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_STATE,
  afterActionTurn,
  afterExploreTurn,
  afterOffer,
  applyChoice,
  endForUnsafeRoute,
  isChoiceId,
  nextStage,
  parseDialogueState,
} from "./dialogueState.ts";

const offered = afterOffer(EMPTY_STATE, 2, "TH-1", ["Q1", "Q2"]);

describe("parseDialogueState", () => {
  test("이상한 값(null, 문자열, 알 수 없는 모드)은 빈 상태로 돌아간다", () => {
    assert.deepEqual(parseDialogueState(null), EMPTY_STATE);
    assert.deepEqual(parseDialogueState("x"), EMPTY_STATE);
    assert.equal(parseDialogueState({ mode: "hack" }).mode, "undecided");
    assert.equal(parseDialogueState({ stage: "??" }).stage, "OPEN");
  });

  test("저장된 값은 그대로 복원된다", () => {
    const s = parseDialogueState({ ...offered, mode: "explore", stage: "CLARIFY", exploreTurns: 2, askedQuestionIds: ["Q1"] });
    assert.equal(s.mode, "explore");
    assert.equal(s.stage, "CLARIFY");
    assert.equal(s.theoryId, "TH-1");
    assert.deepEqual(s.askedQuestionIds, ["Q1"]);
  });
});

describe("선택 전이", () => {
  test("isChoiceId는 두 값만 통과시킨다", () => {
    assert.equal(isChoiceId("action"), true);
    assert.equal(isChoiceId("explore"), true);
    assert.equal(isChoiceId("x"), false);
    assert.equal(isChoiceId(undefined), false);
  });

  test("제안을 받은 적 없는 선택(조작된 요청)은 상태를 바꾸지 않는다", () => {
    assert.equal(applyChoice(EMPTY_STATE, "explore"), EMPTY_STATE);
    assert.equal(applyChoice(EMPTY_STATE, "action"), EMPTY_STATE);
  });

  test("제안 후 '행동 제안받기' → action, '내 고민 더 알아보기' → explore(OPEN부터)", () => {
    assert.equal(applyChoice(offered, "action").mode, "action");
    const e = applyChoice(offered, "explore");
    assert.equal(e.mode, "explore");
    assert.equal(e.stage, "OPEN");
    assert.equal(e.exploreTurns, 0);
  });

  test("탐색 중에도 '행동 제안받기'로 언제든 갈아탈 수 있다", () => {
    assert.equal(applyChoice(applyChoice(offered, "explore"), "action").mode, "action");
  });

  test("이미 끝난(done) 흐름에서는 선택이 무시된다", () => {
    const done = { ...offered, mode: "done" as const };
    assert.equal(applyChoice(done, "explore"), done);
    assert.equal(applyChoice(done, "action"), done);
  });

  test("action은 한 턴짜리 지시라, 그 턴이 끝나면 done으로 돌아간다", () => {
    assert.equal(afterActionTurn(applyChoice(offered, "action")).mode, "done");
    assert.equal(afterActionTurn(offered).mode, "undecided"); // action이 아니면 그대로
  });
});

describe("탐색 진행", () => {
  test("단계는 OPEN → CLARIFY → REFRAME → COMMIT 순서이고 마지막 다음은 없다", () => {
    assert.equal(nextStage("OPEN"), "CLARIFY");
    assert.equal(nextStage("CLARIFY"), "REFRAME");
    assert.equal(nextStage("REFRAME"), "COMMIT");
    assert.equal(nextStage("COMMIT"), null);
  });

  test("질문 하나를 던질 때마다 턴 수가 늘고, 던진 질문이 기록되고, 단계가 한 칸 넘어간다", () => {
    const s0 = applyChoice(offered, "explore");
    const s1 = afterExploreTurn(s0, "Q1", "OPEN", 4);
    assert.equal(s1.exploreTurns, 1);
    assert.deepEqual(s1.askedQuestionIds, ["Q1"]);
    assert.equal(s1.stage, "CLARIFY");
    assert.equal(s1.mode, "explore");
  });

  test("최대 턴 수에 닿으면 done(평소 대화로 복귀)", () => {
    let s = applyChoice(offered, "explore");
    s = afterExploreTurn(s, "Q1", "OPEN", 2);
    s = afterExploreTurn(s, "Q2", "CLARIFY", 2);
    assert.equal(s.mode, "done");
    assert.equal(s.exploreTurns, 2);
  });

  test("COMMIT 단계까지 마치면 최대 턴 전이라도 done", () => {
    const s = afterExploreTurn(applyChoice(offered, "explore"), "Q9", "COMMIT", 10);
    assert.equal(s.mode, "done");
  });

  test("질문을 못 찾은 턴(null)도 턴 수는 올라가서 무한히 탐색만 하지 않는다", () => {
    const s = afterExploreTurn(applyChoice(offered, "explore"), null, "OPEN", 4);
    assert.equal(s.exploreTurns, 1);
    assert.deepEqual(s.askedQuestionIds, []);
  });

  test("explore가 아닌 상태에서는 아무것도 바뀌지 않는다", () => {
    assert.equal(afterExploreTurn(offered, "Q1", "OPEN", 4), offered);
  });
});

describe("안전 경로 이탈", () => {
  test("탐색 중에 허용 경로를 벗어나면 끝낸다", () => {
    assert.equal(endForUnsafeRoute(applyChoice(offered, "explore")).mode, "done");
  });

  test("제안만 받고 고르지 않은 상태도 끝낸다 — 지나간 안내의 칩으로 나중에 탐색이 열리면 안 된다", () => {
    assert.equal(endForUnsafeRoute(offered).mode, "done");
  });

  test("아직 제안한 적 없는 상태는 그대로 둔다", () => {
    assert.equal(endForUnsafeRoute(EMPTY_STATE), EMPTY_STATE);
  });
});
