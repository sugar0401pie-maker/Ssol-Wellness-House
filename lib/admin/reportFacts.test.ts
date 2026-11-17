import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildReportFacts, describeApproach, sessionCode, type FMessage } from "./reportFacts.ts";

const names = {
  theory: new Map([["TH-EFT", "정서중심치료(EFT)"], ["TH-ACT", "수용전념치료(ACT)"]]),
  technique: new Map([["TQ-1", "감정 이름 붙이기"]]),
  rootMainTheory: new Map([["ROOT-12", "TH-EFT"]]),
};
let n = 0;
const msg = (session_id: string, role: "user" | "assistant", content: string, at: string, o: Partial<FMessage> = {}): FMessage => ({
  message_id: `m${n++}`, session_id, role, content, route: role === "assistant" ? "wellness" : null, framework_id: null, theory_id: null, technique_id: null, dialogue_mode: null, reflection_signal_id: null, created_at: at, ...o,
});
const sessions = [
  { session_id: "s2", safety_flag: "crisis", topic_tag: null, started_at: "2026-11-12T02:00:00Z", deleted_at: null },
  { session_id: "s1", safety_flag: "none", topic_tag: "회사 고민", started_at: "2026-11-10T02:00:00Z", deleted_at: "2026-11-11T00:00:00Z" },
];
const messages = [
  msg("s1", "user", "팀장님이 저만 싫어하는 것 같아요", "2026-11-10T02:00:00Z"),
  msg("s1", "assistant", "많이 속상하셨겠어요", "2026-11-10T02:01:00Z", { reflection_signal_id: "sw-root:ROOT-12:1", theory_id: "TH-ACT", technique_id: "TQ-1" }),
  msg("s2", "user", "요즘 아무 의욕이 없고 너무 힘들어요", "2026-11-12T02:00:00Z"),
  msg("s2", "assistant", "(위기 안내)", "2026-11-12T02:01:00Z", { route: "crisis", reflection_signal_id: "sw-scr:suicide:asked" }),
];

describe("보고서 사실 집계", () => {
  const f = buildReportFacts({ sessions, messages, names, rootStates: [] });
  test("세션은 시작 시각 순으로 S01부터 번호가 붙고, 주제는 topic_tag 또는 첫 사용자 말", () => {
    assert.deepEqual(f.sessions.map((s) => s.code), ["S01", "S02"]);
    assert.equal(f.sessions[0].sessionId, "s1");
    assert.equal(f.sessions[0].topic, "회사 고민");
    assert.equal(f.sessions[1].topic, "요즘 아무 의욕이 없고 너무 힘들어요");
    assert.equal(f.sessions[0].deleted, true);
    assert.equal(sessionCode(9), "S10");
  });
  test("이용 요약: 세션·메시지·활동일·경로", () => {
    assert.equal(f.sessionCount, 2);
    assert.equal(f.messageCount, 4);
    assert.equal(f.userMessageCount, 2);
    assert.equal(f.activeDays, 2);
    assert.deepEqual(f.routeCounts, [["crisis", 1], ["wellness", 1]]);
  });
  test("이론: 직접 기록(TH-ACT)과 이유 가설을 통한 주 이론(TH-EFT)을 구분해 센다", () => {
    const act = f.theories.find((t) => t.id === "TH-ACT")!;
    const eft = f.theories.find((t) => t.id === "TH-EFT")!;
    assert.deepEqual([act.direct, act.viaRoots, act.name], [1, 0, "수용전념치료(ACT)"]);
    assert.deepEqual([eft.direct, eft.viaRoots, eft.name], [0, 1, "정서중심치료(EFT)"]);
    assert.deepEqual(f.techniques, [{ id: "TQ-1", name: "감정 이름 붙이기", count: 1 }]);
    assert.deepEqual(f.roots, [{ id: "ROOT-12", count: 1, mainTheory: "정서중심치료(EFT)" }]);
  });
  test("경고: crisis 세션이 urgent로 잡히고, 발췌는 경고가 붙은 메시지 직전의 사용자 말", () => {
    assert.equal(f.overallLevel, "urgent");
    assert.equal(f.alerts.length, 1);
    assert.equal(f.alerts[0].code, "S02");
    assert.equal(f.alerts[0].level, "urgent");
    assert.equal(f.alerts[0].excerpt, "요즘 아무 의욕이 없고 너무 힘들어요");
    assert.deepEqual(f.alerts[0].reasons, ["위기 표현이 명시되어 고정 안내 1회"]); // 이용자 행·응답 행을 따로 세지 않고, 같은 사건의 세션 상태도 중복으로 적지 않는다
  });
  test("경고가 없으면 비어 있고, 뿌리 상태의 주의 표시만 있어도 전체 단계는 watch", () => {
    const clean = buildReportFacts({ sessions: [sessions[1]], messages: messages.slice(0, 2), names, rootStates: [] });
    assert.equal(clean.alerts.length, 0);
    assert.equal(clean.overallLevel, null);
    const rooted = buildReportFacts({ sessions: [sessions[1]], messages: messages.slice(0, 2), names, rootStates: [{ caution_hold: true, safety2_level: null }] });
    assert.equal(rooted.overallLevel, "watch");
    assert.equal(rooted.alerts.length, 0);
    assert.equal(rooted.rootReasons.length, 1);
  });
  test("대화가 전혀 없어도 오류 없이 빈 보고서 사실이 나온다", () => {
    const e = buildReportFacts({ sessions: [], messages: [], names, rootStates: [] });
    assert.equal(e.sessionCount, 0);
    assert.equal(e.firstAt, null);
    assert.deepEqual(e.theories, []);
  });
  test("대화원문 표의 이론·접근 칸", () => {
    assert.equal(describeApproach(messages[1], names), "이론 수용전념치료(ACT) · 기법 감정 이름 붙이기 · 이유 가설 ROOT-12(주 이론 정서중심치료(EFT))");
    assert.equal(describeApproach(messages[0], names), "");
  });
});
