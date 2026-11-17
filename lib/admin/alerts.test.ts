import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { assessMessage, assessRootStates, assessSession, maxLevel } from "./alerts.ts";

const m = (route: string | null, marker: string | null = null) => ({ route, reflection_signal_id: marker });

describe("경고(alert) 판정", () => {
  test("위기·폭력 경로 응답은 urgent", () => {
    assert.equal(assessMessage(m("crisis")), "urgent");
    assert.equal(assessMessage(m("violence")), "urgent");
    assert.equal(assessSession({ safety_flag: "none", messages: [m("wellness"), m("crisis")] }).level, "urgent");
  });
  test("스크리닝 중단(stop)은 urgent, 애매한 답·죽음 이야기에 아니요는 watch, 질문만 한 것(asked)은 표시 없음", () => {
    assert.equal(assessMessage(m("wellness", "sw-scr:suicide:stop")), "urgent");
    assert.equal(assessMessage(m("wellness", "sw-scr:suicide:unclear")), "watch");
    assert.equal(assessMessage(m("wellness", "sw-scr:suicide:ok")), "watch");
    assert.equal(assessMessage(m("wellness", "sw-scr:violence:ok")), null); // 폭력 쪽 "아니요"는 watch 대상이 아님(isWatchMarker 기준)
    assert.equal(assessMessage(m("wellness", "sw-scr:suicide:asked")), null);
  });
  test("세션 안전 상태: crisis=urgent, elevated=watch, none=표시 없음", () => {
    assert.equal(assessSession({ safety_flag: "crisis", messages: [] }).level, "urgent");
    assert.equal(assessSession({ safety_flag: "elevated", messages: [] }).level, "watch");
    const none = assessSession({ safety_flag: "none", messages: [m("wellness"), m(null, "sw-root:ROOT-29:464")] });
    assert.equal(none.level, null);
    assert.deepEqual(none.reasons, []);
  });
  test("urgent와 watch가 함께 있으면 urgent로 올리고 이유를 모두 남긴다", () => {
    const a = assessSession({ safety_flag: "elevated", messages: [m("crisis"), m("wellness", "sw-scr:suicide:unclear")] });
    assert.equal(a.level, "urgent");
    assert.equal(a.reasons.length, 3);
  });
  test("뿌리 상태: urgent / caution·high·caution_hold는 watch / 없으면 null", () => {
    assert.equal(assessRootStates([{ caution_hold: false, safety2_level: "urgent" }]).level, "urgent");
    assert.equal(assessRootStates([{ caution_hold: true, safety2_level: null }]).level, "watch");
    assert.equal(assessRootStates([{ caution_hold: false, safety2_level: "high" }]).level, "watch");
    assert.equal(assessRootStates([{ caution_hold: false, safety2_level: null }]).level, null);
    assert.equal(assessRootStates([]).level, null);
  });
  test("maxLevel", () => {
    assert.equal(maxLevel(null, "watch"), "watch");
    assert.equal(maxLevel("watch", "urgent"), "urgent");
    assert.equal(maxLevel("urgent", null), "urgent");
    assert.equal(maxLevel(null, null), null);
  });
});
