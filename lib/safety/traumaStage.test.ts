import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { detectTraumaStage, STABILIZATION_PRACTICE_IDS } from "./traumaStage.ts";

describe("detectTraumaStage — 약한 트라우마 기준", () => {
  test("트라우마라는 말만 일상적으로 쓰면 T0(일반 경로 유지)", () => {
    assert.equal(detectTraumaStage("면접 트라우마가 있어서 긴장돼요"), "T0");
    assert.equal(detectTraumaStage("예전에 발표하다 망한 게 트라우마예요"), "T0");
  });

  test("지금 압도되는 신호(장면 재생·몸 떨림·숨 막힘·멍함)가 있으면 T1", () => {
    assert.equal(detectTraumaStage("그 장면이 계속 떠올라서 몸이 떨려요"), "T1");
    assert.equal(detectTraumaStage("생각하면 숨이 막혀요"), "T1");
    assert.equal(detectTraumaStage("멍해지고 현실감이 없어요"), "T1");
  });

  test("트라우마 말과 압도 신호가 같이 있으면 더 조심스러운 T1", () => {
    assert.equal(detectTraumaStage("트라우마 때문에 몸이 떨려요"), "T1");
  });

  test("직전 한두 번의 발화에서 압도 신호가 있었다면, 이번에 신호가 없어도 T1을 유지한다(진정되기 전엔 탐색으로 복귀 금지)", () => {
    assert.equal(detectTraumaStage("네 조금 나아졌어요", ["숨이 막혀서 힘들어요"]), "T1");
    assert.equal(detectTraumaStage("네 알겠어요", ["숨이 막혀요", "그냥요", "네"]), null); // 3번 전 발화는 보지 않는다
  });

  test("관련 없는 말은 null", () => {
    assert.equal(detectTraumaStage("요즘 회사 일이 많아서 지쳐요"), null);
    assert.equal(detectTraumaStage("오늘 점심 뭐 먹지", ["기분이 좀 가라앉아요"]), null);
  });

  test("안정화 실천 순서는 접지(5-4 감각) → 호흡 → 관찰 → 감정 세기 순", () => {
    assert.deepEqual([...STABILIZATION_PRACTICE_IDS], ["SELF-MIND-L1-03", "THX-CFT-01", "THX-DBT-02", "THX-DBT-15"]);
  });
});
