// 깊어짐 신호 판별 테스트(네트워크·AI 없음). 예시는 전문위원 검수 묶음 1-3의 신호 설명 그대로.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { askedReason, deepCandidates, deepeningAskBlock, evaluateDeepening, isImproving, DEEPENING_INFO_BLOCK } from "./deepening.ts";

describe("신호 후보", () => {
  test("E-1: 과거와 비교해 더 힘들어졌다고 분명히 말함 — 정도 단어만 바뀐 말은 아님", () => {
    assert.deepEqual(deepCandidates("전보다 훨씬 힘들어요"), ["E-1"]);
    assert.deepEqual(deepCandidates("갈수록 지쳐요"), ["E-1"]);
    assert.deepEqual(deepCandidates("조금 힘들었는데 너무 힘들어요"), []);
    assert.deepEqual(deepCandidates("요즘 힘들어요"), []);
  });
  test("E-2: 기간이 늘어남", () => {
    assert.deepEqual(deepCandidates("몇 달째 계속 힘들어요"), ["E-2"]);
    assert.deepEqual(deepCandidates("3주째 잠이 안 와서 괴로워요"), ["E-2"]);
    assert.deepEqual(deepCandidates("오래전부터 계속 이래요"), ["E-2"]);
    assert.deepEqual(deepCandidates("어제 몇 달째 밀린 일을 끝냈어요"), []);
  });
  test("E-4: 절망·무가치 표현(후보)", () => {
    assert.deepEqual(deepCandidates("해 봤자 소용없어요"), ["E-4"]);
    assert.deepEqual(deepCandidates("저는 원래 안 돼요"), ["E-4"]);
    assert.deepEqual(deepCandidates("오늘 날씨 좋네요"), []);
  });
  test("E-6: 운동을 못 하면 불안 + 상쇄 운동이 늘어남(둘 다 있을 때만)", () => {
    assert.deepEqual(deepCandidates("운동을 못 하면 너무 불안해서 요즘은 하루 두 번씩 해요"), ["E-6"]);
    assert.deepEqual(deepCandidates("운동을 못 하면 불안해요"), []);
    assert.deepEqual(deepCandidates("밥을 많이 먹어서 운동을 더 오래 했어요"), []);
  });
  test("나아지는 신호", () => {
    for (const t of ["조금 나아졌어요", "해 봤어요", "그 방법이 도움이 됐어요"]) assert.equal(isImproving(t), true, t);
    assert.equal(isImproving("여전히 그대로예요"), false);
  });
});

describe("먼저 묻기 → 확정(대화 기록만으로)", () => {
  const asked = "그렇게 느끼신 이유가 있을까요? 요즘 무슨 일이 있었는지 말씀해 주실래요?";
  test("이번 말에 후보가 있으면 다음 답변이 이유를 묻게 한다(아직 세지 않음)", () => {
    const r = evaluateDeepening("전보다 훨씬 힘들어요", null, null);
    assert.deepEqual(r.ask, ["E-1"]);
    assert.deepEqual(r.confirmed, []);
    assert.match(deepeningAskBlock("전보다 훨씬 힘들어요") ?? "", /왜 그렇게 느끼는지/);
    assert.equal(deepeningAskBlock("오늘 날씨 좋네요"), null);
  });
  test("이유를 물은 뒤 일상 이유가 없는 답이 오면 직전 말의 신호를 확정", () => {
    const r = evaluateDeepening("그냥 계속 마음이 무거워요", "전보다 훨씬 힘들어요", asked);
    assert.deepEqual(r.confirmed, ["E-1"]);
  });
  test("일상 이유가 있으면 세지 않는다(\"일 때문이라 그래요\")", () => {
    assert.deepEqual(evaluateDeepening("요즘 야근이 많아서 그래요", "전보다 훨씬 힘들어요", asked).confirmed, []);
  });
  test("이유를 묻지 않았으면 세지 않는다", () => {
    assert.deepEqual(evaluateDeepening("그냥 계속 마음이 무거워요", "전보다 훨씬 힘들어요", "많이 힘드셨겠어요.").confirmed, []);
    assert.equal(askedReason("많이 힘드셨겠어요."), false);
  });
  test("E-4는 이유를 물은 뒤의 답에도 절망 표현이 남아 있을 때만", () => {
    assert.deepEqual(evaluateDeepening("그냥 다 해 봤자 소용없는 것 같아요", "해 봤자 소용없어요", asked).confirmed, ["E-4"]);
    assert.deepEqual(evaluateDeepening("사실 시험 결과가 안 좋아서요", "해 봤자 소용없어요", asked).confirmed, []);
  });
  test("나아지는 말이면 improve", () => {
    assert.equal(evaluateDeepening("그 방법을 해봤더니 조금 나아졌어요", null, null).improve, true);
  });
});

describe("안내 문구 원칙", () => {
  test("휴먼 웰니스 세션을 권하지 않고, 진단명·거절 표현이 없다", () => {
    assert.match(DEEPENING_INFO_BLOCK, /휴먼 웰니스 세션을 권하지 마세요/);
    assert.match(DEEPENING_INFO_BLOCK, /진단명이나 병명을 말하지 마세요/);
    assert.doesNotMatch(DEEPENING_INFO_BLOCK, /(할|드릴)\s*수\s*없어요/);
  });
});
