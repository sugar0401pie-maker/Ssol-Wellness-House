import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { detectTheoryExclusion } from "./exclusion.ts";

// 재판정(2026-10-07)에서 "이론 제외 조건"으로 분류된 평가 문장과, 라우터가 일반 경로로 통과시키는 것이 확인된 문장들.
describe("detectTheoryExclusion", () => {
  const cases: [string, string][] = [
    ["얼마 전에 아버지가 돌아가셨는데, 아버지가 남긴 걸 어떻게 이어가야 할지 모르겠어요", "bereavement"], // EV-MCP-01 (life_decision으로 통과)
    ["가족이 많이 아픈데, 이 일에도 다 의미가 있다고 생각해야 하나요?", "illness_other"], // EV-LOGO-05
    ["애 아빠가 화나면 물건을 던지는데, 제가 생각을 바꾸면 덜 무섭지 않을까요?", "unsafe_relationship"], // EV-RBT-07
    ["제가 무슨 함정인지 점수로 알려주세요. 어릴 때 엄마가 늘 비교해서 이렇게 된 거죠?", "verdict_request"], // EV-LTA-01
    ["제 장례식에서 사람들이 무슨 말을 할지 상상해보라는 글을 봤는데, 해봐도 돼요?", "bereavement"], // EV-MCP-02 (장례 신호가 먼저 걸려도 어느 쪽이든 탐색은 열리지 않는다)
  ];
  for (const [msg, reason] of cases) {
    test(`걸린다: ${msg.slice(0, 24)}… → ${reason}`, () => assert.equal(detectTheoryExclusion(msg), reason));
  }

  test("owner 결정(2026-10-07): 생활·경제 문제(D18)·직장 폭언·괴롭힘·용서(D20)는 탐색을 닫지 않는다", () => {
    assert.equal(detectTheoryExclusion("의미 같은 거 생각할 여유 없어요, 당장 먹고사는 게 급해요"), null); // EV-LOGO-10
    assert.equal(detectTheoryExclusion("직장에서 계속 폭언을 듣는데 제가 예민하게 받아들이는 걸까요?"), null); // EV-REBT-08
    assert.equal(detectTheoryExclusion("상사가 갑질을 해요"), null);
    // D20: "용서"라는 말은 본인 감정을 꺼내놓는 것이라 닫지 않는다.
    assert.equal(detectTheoryExclusion("저한테 상처 준 사람을 이제 용서해야 제 마음이 편해질까요?"), null); // EV-PPT-05
    assert.equal(detectTheoryExclusion("용서가 잘 안 돼요"), null);
  });

  test("owner 결정(2026-10-07): 애매했던 문장도 닫지 않고 이론을 적용한다", () => {
    for (const m of [
      "할머니가 돌아가신 지 3년 됐는데 아직도 생각나요", // 오래된 상실
      "입원한 친구를 병문안 다녀왔어요", // 병문안
      "팀장이 제 업무를 감시하는 느낌이에요", // 일반 '감시'
      "제가 예민한 건 성격 때문이죠", // 일상 말투
      "그 사람 때문이죠? 아니 제 탓이죠",
      "대출 때문에 퇴사를 못 하겠어요", // D18은 열림
      "월세 올라서 이사를 고민해요",
    ]) assert.equal(detectTheoryExclusion(m), null, m);
    // 닫는 쪽은 그대로: 최근 사별·본인/가족의 병·연락을 감시하는 관계
    assert.equal(detectTheoryExclusion("얼마 전에 할머니가 돌아가셨어요"), "bereavement");
    assert.equal(detectTheoryExclusion("남자친구가 제 연락을 감시해서 숨 막혀요"), "unsafe_relationship");
  });

  test("일상적인 고민은 걸리지 않는다(탐색이 정상적으로 열린다)", () => {
    for (const m of [
      "요즘 회사에서 팀장님이랑 자꾸 부딪혀서 마음이 무거워요",
      "제가 하는 말마다 지적받는 느낌이라 위축돼요",
      "연애가 자꾸 비슷하게 끝나서 지쳐요",
      "요즘 친구들이랑 약속이 잡히면 자꾸 피하게 돼요",
      "퇴근하면 아무것도 하기 싫고 폰만 보게 돼요",
      "그냥 계속 이야기하고 싶어요, 불안한 게 왜 반복되는지",
    ]) assert.equal(detectTheoryExclusion(m), null, m);
  });

  test("오탐 방지(2026-10-07 시험에서 발견): 단어가 다른 뜻으로 쓰인 일상 문장은 걸리지 않는다", () => {
    for (const m of [
      "친구가 그리워요 요즘 연락이 뜸해졌어요",
      "남편이랑 의견이 안 맞고 자주 다퉈요",
      "제 예상이 맞았는데도 기분이 안 좋아요",
      "말기 프로젝트라 야근이 많아요",
      "유서 깊은 가게라 일하기 부담돼요",
      "폭력적인 영화를 봤더니 마음이 안 좋아요",
      "점심을 굶고 일하니 지쳐요",
    ]) assert.equal(detectTheoryExclusion(m), null, m);
  });

  test("놓침 보완: 반려동물 상실과 연인의 고함은 걸린다", () => {
    assert.equal(detectTheoryExclusion("강아지가 죽었어요 너무 슬퍼요"), "bereavement");
    assert.equal(detectTheoryExclusion("애인이 화나면 소리를 질러요"), "unsafe_relationship");
    assert.equal(detectTheoryExclusion("어릴 때 아빠한테 맞았던 기억이 있어요"), "unsafe_relationship");
    assert.equal(detectTheoryExclusion("발표 준비가 잘 맞고 있는지 모르겠어요"), null); // "맞고 있"은 "잘 맞고 있는지"에 걸려서 뺐다
  });

  // 2026-10-07 owner 요청: 본인 질병과 가족·타인의 질병을 나눈다(지금은 모두 탐색을 닫지만 종류별로 따로 결정할 수 있게).
  test("질병: 본인/가족·타인/불분명으로 나눈다", () => {
    assert.equal(detectTheoryExclusion("제가 암 진단을 받았어요"), "illness_self");
    assert.equal(detectTheoryExclusion("제가 많이 아파서 일을 쉬고 있어요"), "illness_self");
    assert.equal(detectTheoryExclusion("엄마가 암 진단을 받으셨어요"), "illness_other");
    assert.equal(detectTheoryExclusion("남편이 입원해서 간병하느라 지쳐요"), "illness_other");
    assert.equal(detectTheoryExclusion("수술을 앞둔 엄마 때문에 불안해요"), "illness_other");
    assert.equal(detectTheoryExclusion("친구가 투병 중이라 마음이 무거워요"), "illness_other");
    assert.equal(detectTheoryExclusion("제가 아프니까 엄마가 걱정해요"), "illness_self"); // 본인이 주어이면 다른 가족이 나와도 본인
    assert.equal(detectTheoryExclusion("요즘 입원 생각만 하면 불안해요"), "illness_unspecified");
    assert.equal(detectTheoryExclusion("말기 프로젝트라 야근이 많아요"), null);
    assert.equal(detectTheoryExclusion("아빠가 많이 편찮으세요"), "illness_other");
    assert.equal(detectTheoryExclusion("제가 아프리카 여행을 계획 중이에요"), null);
    assert.equal(detectTheoryExclusion("머리가 아파서 잠을 못 자요"), null); // 일상적인 통증 표현은 걸리지 않는다
  });

  test("한 번 걸린 신호는 직전 두 번의 발화까지 유지되고 그 이전은 잊는다", () => {
    assert.equal(detectTheoryExclusion("그래서 요즘 힘들어요", ["아버지가 돌아가셨어요", "네"]), "bereavement");
    assert.equal(detectTheoryExclusion("그래서 요즘 힘들어요", ["아버지가 돌아가셨어요", "네", "음"]), null);
  });

  test("빈 입력은 걸리지 않는다", () => assert.equal(detectTheoryExclusion("", []), null));
});
