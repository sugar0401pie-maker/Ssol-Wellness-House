import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { annotateExplicit, assessMessage, assessRootStates, assessSession, maxLevel } from "./alerts.ts";

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

// 한 번의 위기 상황 = 이용자 행 + 쏘웰라 응답 행(둘 다 같은 route가 붙는다).
const pair = (route: string, explicit?: boolean) => [
  { role: "user", route, reflection_signal_id: null, ...(explicit === undefined ? {} : { explicit }) },
  { role: "assistant", route, reflection_signal_id: null, ...(explicit === undefined ? {} : { explicit }) },
];

describe("URGENT 보정 — 명시적 표현과 AI 분류 단독 판단 구분(2026-11-17)", () => {
  test("명시적 표현이 확인된 위기 안내는 URGENT, 응답 횟수는 쏘웰라 행만 센다(이중 집계 없음)", () => {
    const a = assessSession({ safety_flag: "crisis", messages: pair("crisis", true) });
    assert.equal(a.level, "urgent");
    assert.deepEqual(a.reasons, ["위기 표현이 명시되어 고정 안내 1회"]); // 세션 안전 상태 crisis는 같은 사건이라 따로 세지 않는다
  });
  test("AI 분류 단독 판단(명시적 표현 없음)으로 나간 위기 안내는 WATCH — 그래도 경고에서 빠지지 않는다", () => {
    const a = assessSession({ safety_flag: "crisis", messages: pair("crisis", false) });
    assert.equal(a.level, "watch");
    assert.equal(a.reasons.length, 1);
    assert.ok(a.reasons[0].includes("명시적 표현은 없음"));
  });
  test("폭력·통제도 같은 기준", () => {
    assert.equal(assessSession({ safety_flag: "none", messages: pair("violence", true) }).level, "urgent");
    assert.equal(assessSession({ safety_flag: "none", messages: pair("violence", false) }).level, "watch");
  });
  test("확인하지 못한 경우(explicit 비어 있음)는 낮추지 않는다 — 안전 쪽 URGENT", () => {
    assert.equal(assessSession({ safety_flag: "none", messages: pair("crisis") }).level, "urgent");
  });
  test("같은 세션에 명시적 표현이 한 번이라도 있으면 URGENT", () => {
    assert.equal(assessSession({ safety_flag: "crisis", messages: [...pair("crisis", false), ...pair("crisis", true)] }).level, "urgent");
  });
  test("세션 안전 상태만 crisis이고 위기 경로 기록이 없으면(기간 밖 등) 낮추지 않고 URGENT", () => {
    const a = assessSession({ safety_flag: "crisis", messages: [{ role: "user", route: "wellness", reflection_signal_id: null }] });
    assert.equal(a.level, "urgent");
    assert.deepEqual(a.reasons, ["세션 안전 상태: 위기(crisis)"]);
  });
  test("메시지 표시: AI 분류 단독은 WATCH, 명시는 URGENT", () => {
    assert.equal(assessMessage({ role: "user", route: "crisis", reflection_signal_id: null, explicit: false }), "watch");
    assert.equal(assessMessage({ role: "user", route: "crisis", reflection_signal_id: null, explicit: true }), "urgent");
    assert.equal(assessMessage({ role: "assistant", route: "violence", reflection_signal_id: null }), "urgent");
  });
  test("스크리닝 중단(stop)은 여전히 URGENT", () => {
    assert.equal(assessSession({ safety_flag: "none", messages: [{ role: "assistant", route: "wellness", reflection_signal_id: "sw-scr:suicide:stop" }] }).level, "urgent");
  });
});

describe("명시성 표시 매기기(annotateExplicit)", () => {
  const row = (id: string, session_id: string, role: string, route: string | null, at: string): { id: string; session_id: string; role: string; route: string | null; created_at: string; explicit?: boolean } => ({ id, session_id, role, route, created_at: at });
  const rows = [
    row("a2", "s1", "assistant", "crisis", "2026-11-01T00:00:02Z"), // 순서가 뒤섞여 들어와도
    row("a1", "s1", "user", "crisis", "2026-11-01T00:00:01Z"),
    row("b1", "s1", "user", "wellness", "2026-11-01T00:00:03Z"),
    row("c1", "s2", "user", "violence", "2026-11-02T00:00:01Z"),
    row("c2", "s2", "assistant", "violence", "2026-11-02T00:00:02Z"),
  ];
  test("위기·폭력 경로 이용자 행에 값을 매기고, 바로 뒤 쏘웰라 행은 같은 값을 물려받는다", () => {
    const out = annotateExplicit(rows, (m) => m.id === "a1");
    const by = Object.fromEntries(out.map((m) => [m.id, m.explicit]));
    assert.equal(by.a1, true);
    assert.equal(by.a2, true);
    assert.equal(by.c1, false);
    assert.equal(by.c2, false);
    assert.equal(by.b1, undefined); // 일반 경로는 건드리지 않는다
  });
  test("판정기가 모른다고 답하면(undefined) 값을 비워 둔다", () => {
    const out = annotateExplicit(rows, () => undefined);
    assert.ok(out.every((m) => m.explicit === undefined));
  });
  test("원본 배열을 바꾸지 않는다", () => {
    annotateExplicit(rows, () => true);
    assert.ok(rows.every((m) => !("explicit" in m)));
  });
});

describe("새 안전 응답 표시(2026-11-18)", () => {
  test("듣기 단계 응답(sw-safe:safety:listen)은 WATCH, 평소 응답 표시는 없음", () => {
    assert.equal(assessMessage({ role: "assistant", route: "clinical_distress", reflection_signal_id: "sw-safe:safety:listen" }), "watch");
    assert.equal(assessSession({ safety_flag: "elevated", messages: [{ role: "assistant", route: "clinical_distress", reflection_signal_id: "sw-safe:safety:listen" }] }).level, "watch");
    assert.equal(assessMessage({ role: "assistant", route: "wellness", reflection_signal_id: "sw-safe:follow:direct" }), null);
  });
  test("직접 위기 표현 응답은 경로(crisis)로 URGENT 그대로", () => {
    assert.equal(assessMessage({ role: "assistant", route: "crisis", reflection_signal_id: "sw-safe:safety:direct" }), "urgent");
  });
});
