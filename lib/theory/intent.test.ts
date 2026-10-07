import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { declaresNextStep, detectTextIntent, isVagueAnswer } from "./intent.ts";

describe("detectTextIntent", () => {
  test("방법만 원하면 action, 더 이야기하고 싶으면 explore, 그만하자면 stop", () => {
    assert.equal(detectTextIntent("그냥 방법만 알려주세요"), "action");
    assert.equal(detectTextIntent("바로 해볼 수 있는 걸 알려줘요"), "action");
    assert.equal(detectTextIntent("조금 더 이야기하고 싶어요"), "explore");
    assert.equal(detectTextIntent("이제 그만할래요"), "stop");
    assert.equal(detectTextIntent("그 얘기는 싫어요"), "stop");
  });
  test("stop이 다른 의도보다 먼저다(안전한 쪽)", () => {
    assert.equal(detectTextIntent("방법만 알려줘요 그만 얘기하고 싶어요"), "stop");
  });
  test("관련 없는 말은 null", () => {
    assert.equal(detectTextIntent("오늘 회사에서 일이 많았어요"), null);
    assert.equal(detectTextIntent("그만큼 힘들었어요"), null);
    assert.equal(detectTextIntent("회사를 그만두고 싶어요"), null);
    assert.equal(detectTextIntent(""), null);
  });
});

describe("declaresNextStep / isVagueAnswer", () => {
  test("다음 걸음을 말하면 true", () => {
    assert.equal(declaresNextStep("제목이라도 써볼게요"), true);
    assert.equal(declaresNextStep("그렇게 해볼래요"), true);
    assert.equal(declaresNextStep("모르겠어요"), false);
  });
  test("짧거나 막연한 답은 vague, 구체적인 답은 아님", () => {
    assert.equal(isVagueAnswer("네"), true);
    assert.equal(isVagueAnswer("몰라요 그냥요"), true);
    assert.equal(isVagueAnswer("커피 마시고 유튜브 보는데 오히려 더 불안해져요"), false);
  });
});
