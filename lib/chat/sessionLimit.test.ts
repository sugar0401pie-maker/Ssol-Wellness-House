import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SESSION_LIMIT_REPLY, SESSION_USER_MESSAGE_LIMIT, sessionLimitState } from "./sessionLimit.ts";

describe("sessionLimitState — 사용자 메시지 20개 상한", () => {
  test("기본 상한은 20개", () => {
    assert.equal(SESSION_USER_MESSAGE_LIMIT, 20);
  });

  test("19번째까지는 평소처럼(팝업 없음, 막지 않음)", () => {
    assert.deepEqual(sessionLimitState(1), { reached: false, blocked: false });
    assert.deepEqual(sessionLimitState(19), { reached: false, blocked: false });
  });

  test("20번째 메시지는 답변을 받고, 그 답변 뒤에 팝업을 띄운다(막지 않음)", () => {
    assert.deepEqual(sessionLimitState(20), { reached: true, blocked: false });
  });

  test("21번째부터는 답변을 만들지 않고 막는다(+팝업)", () => {
    assert.deepEqual(sessionLimitState(21), { reached: true, blocked: true });
    assert.deepEqual(sessionLimitState(35), { reached: true, blocked: true });
  });

  test("상한 값을 바꿔도 같은 규칙", () => {
    assert.deepEqual(sessionLimitState(2, 2), { reached: true, blocked: false });
    assert.deepEqual(sessionLimitState(3, 2), { reached: true, blocked: true });
  });

  test("안내 문구에 owner가 정한 문장이 들어 있고, 거절형('~할 수 없어요')이 아니다", () => {
    assert.match(SESSION_LIMIT_REPLY, /원활한 대화를 위해 새로운 대화로 다시 시작해보세요/);
    assert.doesNotMatch(SESSION_LIMIT_REPLY, /할 수 없어요|못해요/);
  });
});
