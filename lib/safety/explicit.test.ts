import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { screenExplicit } from "./explicit.ts";

const level = (t: string) => screenExplicit(t).level;
const violence = (t: string) => screenExplicit(t).violence;

describe("직접 표현 판정 — CSO 2026-11-18(개발 요청 v1.3 §2)", () => {
  test("죽음·자해를 직접 말하면 urgent", () => {
    for (const t of ["죽고 싶어요", "자살하고 싶다는 생각이 들어요", "자해를 했어요", "유서를 써 봤어요", "극단적 선택을 생각해요", "목숨을 끊고 싶어요"]) assert.equal(level(t), "urgent", t);
  });
  test("④ 놓쳤던 말: '나 그냥 죽을 거야'는 urgent", () => {
    assert.equal(level("나 그냥 죽을 거야"), "urgent");
    assert.equal(level("오늘 밤에 죽을게요"), "urgent");
  });
  test("관용 표현은 위기가 아님(죽을 것 같아·배고파 죽겠어·설레 죽는)", () => {
    for (const t of ["배고파 죽을 것 같아요", "피곤해 죽겠어요", "설레 죽는 줄", "폰이 죽어버렸어요", "혼자 살기 힘들어요", "투자해서 손해 봤어요", "유서 깊은 가게예요"]) assert.equal(level(t), "none", t);
  });
  test("⑤ '살 이유가 없다'·'생을 마감'·사라지고 싶다는 직접 표현이 아니라 듣기 쪽(watch)", () => {
    for (const t of ["살 이유가 없어요", "사라지고 싶어요", "생을 마감하고 싶다", "나를 해치고 싶어요", "제가 없는 게 나을 것 같아요"]) assert.equal(level(t), "watch", t);
  });
  test("일상 글은 watch로 잡지 않음(타로 v3.1.1 오탐 고침)", () => {
    for (const t of ["어차피 말해도 안 바뀔 것 같아요", "앞으로도 계속 이럴까요?", "회식에서 술 마셔야 해서 걱정", "강아지가 죽을까 봐 무서워요", "어제 체해서 게워냈어요"]) assert.equal(level(t), "none", t);
    assert.equal(level("뭘 해도 안 바뀔 거예요"), "watch");
  });
  test("③ 짧은 뒷말은 그 글자만 본다 — 앞 메시지 판단을 잇지 않음", () => {
    for (const t of ["둘 다요", "네", "모르겠오", "마지막일지도... 모르겠오"]) assert.equal(level(t), "none", t);
  });
});

describe("폭력은 구체적인 행동이 있을 때만(② · 쏘웰라 2026-09-22 결정)", () => {
  test("④ 사이에 말이 끼어도 맞는다는 말은 폭력", () => {
    assert.equal(violence("남자친구한테 거의 매일 맞고 있어요"), "physical");
    assert.equal(violence("남편이 저를 때려요"), "physical");
    assert.equal(violence("헤어지자고 하면 죽어버리겠대요"), "physical");
  });
  test("통제·스토킹은 control", () => {
    assert.equal(violence("남친이 매일 휴대폰을 검사해요"), "control");
    assert.equal(violence("헤어진 사람이 계속 따라다녀요"), "control");
  });
  test("직장 괴롭힘·낱말 하나·정신적 폭력·회사 감시는 폭력이 아님(평소 대화)", () => {
    for (const t of ["팀장이 자꾸 괴롭혀서 힘들어요", "회사에서 괴롭힘을 당해요", "폭력", "남편이 정신적으로 저를 폭력적으로 대해요", "언어폭력이 심해요", "회사가 직원들을 감시해요", "문제를 다 맞았어요"]) assert.equal(violence(t), null, t);
  });
  test("남이 말한 협박은 위기(urgent)가 아니라 폭력", () => {
    const r = screenExplicit("헤어지자고 하면 죽어버리겠대요");
    assert.equal(r.level, "none");
    assert.equal(r.violence, "physical");
  });
});
