// 사별·질병 지침(R3)과 점수·진단 확정 요청(S5) 판단 테스트.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isVerdictRequest, medicalReferralGiven, situationGuidance, verdictAction } from "./situations.ts";
import { VERDICT_SECOND_REPLY } from "./screeningTexts.ts";

describe("R3 사별", () => {
  test("최근 상실은 공감·안정화 먼저, 휴먼 세션으로 안내하지 않는다", () => {
    const g = situationGuidance("얼마 전에 아버지가 돌아가셨어요", [], []) ?? "";
    assert.match(g, /공감과 안정화가 먼저/);
    assert.match(g, /휴먼 웰니스 세션으로 안내하지 말고/);
    assert.match(g, /정신건강 전문가와 상의/);
  });
  test("오래전 상실은 일반 애도처럼 이어간다", () => {
    const g = situationGuidance("할머니가 돌아가신 지 3년 됐는데 아직도 생각나요", [], []) ?? "";
    assert.match(g, /평소처럼 대화/);
  });
  test("상실 이야기가 없으면 지침이 없다", () => {
    assert.equal(situationGuidance("오늘 날씨가 좋네요", [], []), null);
  });
});

describe("R3 본인 질병 · 가족·타인 질병", () => {
  test("본인 질병: 처음에는 의료 전문가 상의를 한 번 안내", () => {
    const g = situationGuidance("제가 암 진단을 받았어요", [], []) ?? "";
    assert.match(g, /한 번만 담당 의사/);
    assert.match(g, /휴먼 웰니스 세션으로 안내하지 마세요/);
  });
  test("본인 질병: 이미 안내했으면 되풀이하지 않는다", () => {
    const prev = ["많이 놀라셨겠어요. 치료에 대해서는 담당 의사와 상의해보시면 좋겠어요."];
    assert.equal(medicalReferralGiven(prev), true);
    const g = situationGuidance("제가 암 진단을 받았는데 요즘 잠이 안 와요", [], prev) ?? "";
    assert.match(g, /되풀이하지 마세요/);
  });
  test("가족·타인 질병은 일반 고민으로 다룬다", () => {
    const g = situationGuidance("엄마가 암 진단을 받으셨어요", [], []) ?? "";
    assert.match(g, /일반적인 고민으로 공감/);
    assert.doesNotMatch(g, /휴먼 웰니스 세션을 권/);
  });
  test("병문안·일상은 해당 없음", () => {
    assert.equal(situationGuidance("입원한 친구를 병문안 다녀왔어요", [], []), null);
  });
  test("모든 지침에 '~할 수 없어요' 거절 표현이 없다", () => {
    for (const m of ["얼마 전에 아버지가 돌아가셨어요", "제가 암 진단을 받았어요", "엄마가 암 진단을 받으셨어요"]) assert.doesNotMatch(situationGuidance(m, [], []) ?? "", /(할|드릴)\s*수\s*없어요/);
  });
});

describe("S5 점수·진단·원인 확정 요청", () => {
  test("요청을 알아본다", () => {
    for (const t of ["제가 무슨 유형인지 점수로 알려주세요", "몇 점이에요?", "원인을 알려주세요", "정확히 알려줘"]) assert.equal(isVerdictRequest(t), true, t);
    for (const t of ["오늘 점수가 좋았어요", "원인을 같이 생각해볼까요", "요즘 힘들어요"]) assert.equal(isVerdictRequest(t), false, t);
  });
  test("첫 요청 → 반영 + 이면의 욕구 질문, 두 번째 → 고정 안내, 그 뒤 → 되풀이 금지", () => {
    const ask = "제 점수를 점수로 알려주세요";
    assert.equal(verdictAction(ask, [], []), "first");
    assert.equal(verdictAction(ask, ["점수로 알려주세요"], ["혹시 그 질문을 하게 된 마음을 알 수 있을까요?"]), "second");
    assert.equal(verdictAction(ask, ["점수로 알려주세요", "점수로 알려주세요"], [VERDICT_SECOND_REPLY]), "repeat");
    assert.equal(verdictAction("요즘 힘들어요", ["점수로 알려주세요"], []), "none");
  });
  test("두 번째 안내는 제안형이고 표시 낱말을 유지한다", () => {
    assert.match(VERDICT_SECOND_REPLY, /개인 웰니스 세션/);
    assert.match(VERDICT_SECOND_REPLY, /단정/);
    assert.doesNotMatch(VERDICT_SECOND_REPLY, /(할|드릴)\s*수\s*없어요/);
  });
});
