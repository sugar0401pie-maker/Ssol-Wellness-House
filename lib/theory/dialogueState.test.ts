import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_STATE, MAX_OFFERS, afterOffer, decideTurn, endForUnsafeRoute, endFlow, extendExplore, isChoiceId, parseDialogueState, startExplore, stepExplore, withTheory,
  type DialogueState,
} from "./dialogueState.ts";

const base = { userTurn: 1, choiceId: null, textIntent: null, implicitExplore: true } as const;
const offered1 = afterOffer(EMPTY_STATE, 2);
const offered2 = afterOffer(offered1, 3);

describe("parseDialogueState / isChoiceId", () => {
  test("이상한 값은 빈 상태로, 저장된 값은 그대로 복원", () => {
    assert.deepEqual(parseDialogueState(null), EMPTY_STATE);
    assert.equal(parseDialogueState({ mode: "hack" }).mode, "undecided");
    assert.equal(parseDialogueState({ stage: "??" }).stage, "OPEN");
    assert.equal(parseDialogueState({ offerCount: 99 }).offerCount, MAX_OFFERS);
    const s = parseDialogueState({ ...EMPTY_STATE, mode: "explore", theoryId: "TH-ACT", stage: "REFRAME", exploreTurns: 2, askedQuestionIds: ["Q1"], pendingExtension: true });
    assert.equal(s.theoryId, "TH-ACT"); assert.equal(s.pendingExtension, true); assert.deepEqual(s.askedQuestionIds, ["Q1"]);
  });
  test("칩 id 네 개만 통과", () => {
    for (const ok of ["action", "explore", "extend", "finish"]) assert.equal(isChoiceId(ok), true);
    assert.equal(isChoiceId("x"), false); assert.equal(isChoiceId(undefined), false);
  });
});

describe("decideTurn — 선택 안내", () => {
  test("두 번째 사용자 메시지에서 항상 선택 안내(이론 매칭과 무관), 첫·세 번째는 아님", () => {
    assert.deepEqual(decideTurn({ ...base, state: EMPTY_STATE, userTurn: 2 }), { kind: "offer", offerNo: 1 });
    assert.deepEqual(decideTurn({ ...base, state: EMPTY_STATE, userTurn: 1 }), { kind: "none" });
    assert.deepEqual(decideTurn({ ...base, state: EMPTY_STATE, userTurn: 3 }), { kind: "none" });
  });
  test("제안을 받은 적 없는데 칩 요청이 오면(조작) 일반 메시지로", () => {
    assert.deepEqual(decideTurn({ ...base, state: EMPTY_STATE, userTurn: 2, choiceId: "explore" }), { kind: "none" });
  });
  test("칩 선택: action → 행동 제안, explore → 탐색 시작", () => {
    assert.deepEqual(decideTurn({ ...base, state: offered1, userTurn: 3, choiceId: "action" }), { kind: "action" });
    assert.deepEqual(decideTurn({ ...base, state: offered1, userTurn: 3, choiceId: "explore" }), { kind: "explore_start", implicit: false });
  });
  test("글로 의도를 말하면(방법만 / 더 이야기) 칩을 안 눌러도 같은 의미", () => {
    assert.deepEqual(decideTurn({ ...base, state: offered1, userTurn: 3, textIntent: "action" }), { kind: "action" });
    assert.deepEqual(decideTurn({ ...base, state: offered1, userTurn: 3, textIntent: "explore" }), { kind: "explore_start", implicit: false });
  });
  test("칩을 안 누르고 이어 말하면 한 번만 다시 보여주고, 또 이어 말하면 탐색으로 간주(D1)", () => {
    assert.deepEqual(decideTurn({ ...base, state: offered1, userTurn: 3 }), { kind: "offer", offerNo: 2 });
    assert.deepEqual(decideTurn({ ...base, state: offered2, userTurn: 4 }), { kind: "explore_start", implicit: true });
  });
  test("간주 설정을 끄면 두 번 안내 후에는 평소 대화", () => {
    assert.deepEqual(decideTurn({ ...base, state: offered2, userTurn: 4, implicitExplore: false }), { kind: "none" });
  });
  test("그만하자고 하면 어떤 상태에서도 끝(이미 끝났으면 평소 대화)", () => {
    assert.deepEqual(decideTurn({ ...base, state: offered1, userTurn: 3, textIntent: "stop" }), { kind: "end" });
    assert.deepEqual(decideTurn({ ...base, state: startExplore(offered1, false), textIntent: "stop" }), { kind: "end" });
    assert.deepEqual(decideTurn({ ...base, state: endFlow(offered1), textIntent: "stop" }), { kind: "none" });
  });
  test("끝난 흐름은 다시 열리지 않는다", () => {
    assert.deepEqual(decideTurn({ ...base, state: endFlow(offered1), userTurn: 2 }), { kind: "none" });
    assert.deepEqual(decideTurn({ ...base, state: endFlow(offered1), userTurn: 5, choiceId: "explore" }), { kind: "none" });
  });
});

describe("탐색 진행(stepExplore)", () => {
  const long = "커피 마시고 유튜브를 보는데 오히려 더 불안해져요";
  const explore = withTheory(startExplore(offered1, false), "TH-ACT", "llm");

  test("OPEN → CLARIFY → REFRAME → COMMIT 순서, 한 턴에 한 단계", () => {
    const s1 = stepExplore(explore, long, 6, "Q-open");
    assert.equal(s1.stage, "OPEN"); assert.equal(s1.nextState.stage, "CLARIFY"); assert.deepEqual(s1.nextState.askedQuestionIds, ["Q-open"]);
    const s2 = stepExplore(s1.nextState, long, 6, "Q-clar");
    assert.equal(s2.stage, "CLARIFY"); assert.equal(s2.nextState.stage, "REFRAME");
    const s3 = stepExplore(s2.nextState, long, 6, "Q-ref");
    assert.equal(s3.stage, "REFRAME"); assert.equal(s3.nextState.stage, "COMMIT");
    const s4 = stepExplore(s3.nextState, long, 6, null);
    assert.equal(s4.stage, "COMMIT"); assert.equal(s4.offerExtension, true); assert.equal(s4.nextState.pendingExtension, true); assert.equal(s4.finished, false);
  });
  test("CLARIFY에서 답이 막연하면 한 번 더 묻고, 두 번째부터는 넘어간다", () => {
    const atClarify = { ...explore, stage: "CLARIFY" as const, exploreTurns: 1 };
    const a = stepExplore(atClarify, "몰라요", 6, "Q1");
    assert.equal(a.nextState.stage, "CLARIFY"); assert.equal(a.nextState.clarifyCount, 1);
    const b = stepExplore(a.nextState, "그냥요", 6, "Q2");
    assert.equal(b.nextState.stage, "REFRAME");
  });
  test("사용자가 다음 걸음을 말하면 COMMIT으로 바로 넘어간다", () => {
    const atClarify = { ...explore, stage: "CLARIFY" as const, exploreTurns: 1 };
    const s = stepExplore(atClarify, "제목이라도 써볼게요", 6, null);
    assert.equal(s.stage, "COMMIT");
  });
  test("상한 턴에 닿으면 이번 턴이 정리(COMMIT)이고 연장 칩 없이 끝난다", () => {
    const late: DialogueState = { ...explore, stage: "CLARIFY", exploreTurns: 5 };
    const s = stepExplore(late, long, 6, null);
    assert.equal(s.stage, "COMMIT"); assert.equal(s.finished, true); assert.equal(s.offerExtension, false); assert.equal(s.nextState.mode, "done");
  });
  test("연장: COMMIT 뒤 CLARIFY부터 한 번 더, 연장은 최대 2회, 상한 근처면 연장 칩을 안 보낸다", () => {
    const afterCommit: DialogueState = { ...explore, stage: "COMMIT", exploreTurns: 4, pendingExtension: true };
    const ext = extendExplore(afterCommit);
    assert.equal(ext.stage, "CLARIFY"); assert.equal(ext.pendingExtension, false); assert.equal(ext.extensionsUsed, 1);
    const nearCap: DialogueState = { ...explore, stage: "COMMIT", exploreTurns: 4 };
    assert.equal(stepExplore(nearCap, long, 6, null).offerExtension, false); // turn 5 → cap-1 = 5 → 연장 불가
    const used: DialogueState = { ...explore, stage: "COMMIT", exploreTurns: 3, extensionsUsed: 2 };
    assert.equal(stepExplore(used, long, 6, null).offerExtension, false);
  });
  test("연장 칩 뒤: finish → 끝, 칩 없이 말 이어가면 extend, 탐색 중 action 칩은 행동 제안", () => {
    const pending: DialogueState = { ...explore, stage: "COMMIT", exploreTurns: 4, pendingExtension: true };
    assert.deepEqual(decideTurn({ ...base, state: pending, userTurn: 8, choiceId: "finish" }), { kind: "finish" });
    assert.deepEqual(decideTurn({ ...base, state: pending, userTurn: 8 }), { kind: "extend" });
    assert.deepEqual(decideTurn({ ...base, state: explore, userTurn: 8, choiceId: "action" }), { kind: "action" });
    assert.deepEqual(decideTurn({ ...base, state: explore, userTurn: 8 }), { kind: "explore_turn" });
  });
});

describe("endForUnsafeRoute", () => {
  test("탐색 중이거나 제안만 받은 상태에서 위험 경로가 되면 끝낸다", () => {
    assert.equal(endForUnsafeRoute(startExplore(offered1, false)).mode, "done");
    assert.equal(endForUnsafeRoute(offered1).mode, "done");
  });
  test("아직 아무것도 시작하지 않았으면 그대로", () => {
    assert.equal(endForUnsafeRoute(EMPTY_STATE), EMPTY_STATE);
  });
});
