import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { composeReply, helpResources, planTurn, safetyMarker, ACTION_HREF } from "./safetyReply.ts";
import { SAFETY_REPLIES } from "./safetyReplyData.ts";

const PHONE = /\b(109|1577-?0199|1366|112|119)\b/;
// 한 대화를 순서대로 흘려 본다(상태는 JSON으로 저장했다 다시 읽는 것처럼).
function run(turns: { codes?: string[]; heavy?: boolean; text?: string }[]) {
  let state: unknown = null;
  return turns.map((t) => {
    const r = planTurn(state === null ? null : JSON.parse(JSON.stringify(state)), { codes: t.codes ?? [], heavy: t.heavy ?? false, text: t.text ?? "" });
    state = r.state;
    return { ...r, ...composeReply(r.plan) };
  });
}

describe("안전 신호 뒤의 응답 — CSO 2026-11-18", () => {
  test("직접 위기 표현: 고정 안내문 없이 공감 + 듣는 질문, 대화에 전화번호 없음, 첫 번째엔 버튼 없음", () => {
    const [r] = run([{ codes: ["S1-b"] }]);
    assert.equal(r.plan.mode, "safety");
    assert.deepEqual(r.plan.parts.map((p) => p.kind), ["empathy", "listen"]);
    assert.equal(PHONE.test(r.text), false);
    assert.equal(r.action, null);
    assert.equal(safetyMarker(r.plan), "sw-safe:safety:direct");
  });
  test("응급(약을 한꺼번에 먹음)도 첫 답은 몸이 먼저라는 공감 문장 — 버튼은 4번째에(대표님 확인: CSO 결정 그대로)", () => {
    const [r] = run([{ codes: ["S7-a"] }]);
    assert.equal(r.plan.tier, "emergency");
    assert.ok(r.text.startsWith("지금은 몸이 먼저예요"));
    assert.equal(r.action, null);
  });
  test("힘든 메시지 4번째에 한 번만 마이페이지 안내 + 버튼(어떤 신호든 같음)", () => {
    const rs = run([{ codes: ["S1-a"] }, { heavy: true }, { codes: ["V1"] }, { heavy: true }, { codes: ["S1-b"] }, { codes: ["S1-b"] }]);
    assert.deepEqual(rs.map((r) => r.action?.target ?? null), [null, null, null, "mypage_help", null, null]);
    assert.equal(rs[3].action?.label, "마이페이지로 가기");
    assert.ok(rs[3].text.includes("마이페이지"));
    assert.equal(ACTION_HREF.mypage_help, "/mypage#help");
  });
  test("신호 뒤 평범한 말은 이어 듣기(6턴) → 그다음 평소 대화", () => {
    const rs = run([{ codes: ["S1-a"] }, ...Array.from({ length: 7 }, () => ({}))]);
    assert.deepEqual(rs.map((r) => r.plan.mode), ["safety", "follow", "follow", "follow", "follow", "follow", "follow", "normal"]);
  });
  test("같은 말만 한다는 반응엔 사과하고 듣기", () => {
    const rs = run([{ codes: ["S1-b"] }, { text: "왜 자꾸 같은 말만 해" }]);
    assert.equal(rs[1].plan.mode, "repair");
    assert.ok(rs[1].text.includes("미안해요"));
  });
  test("한 대화에서 같은 문장을 되풀이하지 않는다(문장이 남아 있는 동안)", () => {
    const rs = run([{ codes: ["S1-b"] }, { codes: ["S1-b"] }, { codes: ["S1-b"] }]);
    const ids = rs.flatMap((r) => r.plan.parts.map((p) => p.reply_id));
    assert.equal(new Set(ids).size, ids.length);
  });
  test("신호가 없고 힘든 말도 아니면 평소 대화(문장 없음)", () => {
    const [r] = run([{}]);
    assert.equal(r.plan.mode, "normal");
    assert.equal(r.text, "");
  });
  test("깨진 상태값이 와도 새 대화로 보고 동작한다", () => {
    const r = planTurn({ nonsense: true }, { codes: ["S1-b"], heavy: false, text: "" });
    assert.equal(r.plan.mode, "safety");
  });
  test("문장 데이터 어디에도 전화번호가 없고, 도움받을 곳에만 있다", () => {
    for (const s of SAFETY_REPLIES) assert.equal(PHONE.test(s.text), false, s.reply_id);
    const res = helpResources();
    assert.deepEqual(res.map((r) => r.contact), ["카카오톡", "109", "1577-0199", "1366", "112", "119"]);
    assert.equal(res[0].url, "https://pf.kakao.com/_DAxbYG");
  });
});
