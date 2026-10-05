import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_STATE, afterOffer } from "./dialogueState.ts";
import {
  OFFER_CHOICES,
  OFFER_LEAD,
  buildOfferMessage,
  canOfferNow,
  isDialogueRouteAllowed,
  isOfferMessage,
} from "./offer.ts";
import { getTheoryConfig } from "./config.ts";

const ok = { enabled: true, route: "wellness" as const, isPersonaQuestion: false, userTurn: 2, state: EMPTY_STATE };

describe("선택 안내 문구", () => {
  test("owner가 지정한 문구 그대로이고 {닉네임}만 바뀐다", () => {
    assert.equal(
      buildOfferMessage("수진"),
      "지금 당장 시도해보실 수 있는 마음이 나아지는 방법을 알려드릴까요? 아니면 조금 더 웰니스 관점에서 수진님의 고민에 대해 깊게 알아보시겠어요?",
    );
  });

  test("닉네임이 없거나 공백이면 '회원님'", () => {
    assert.match(buildOfferMessage(null), /회원님의 고민/);
    assert.match(buildOfferMessage("  "), /회원님의 고민/);
  });

  test("칩 글자는 '행동 제안받기', '내 고민 더 알아보기' 두 개", () => {
    assert.deepEqual(
      OFFER_CHOICES.map((c) => [c.id, c.label]),
      [
        ["action", "행동 제안받기"],
        ["explore", "내 고민 더 알아보기"],
      ],
    );
  });

  test("저장된 대화에서 선택 안내를 알아본다(닉네임이 달라도)", () => {
    assert.equal(isOfferMessage(buildOfferMessage("민지")), true);
    assert.equal(isOfferMessage(OFFER_LEAD), true);
    assert.equal(isOfferMessage("안녕하세요"), false);
  });
});

describe("canOfferNow", () => {
  test("조건이 모두 맞으면(켜짐, 허용 경로, 2번째 질문, 아직 제안 전) 제안한다", () => {
    assert.equal(canOfferNow(ok), true);
    assert.equal(canOfferNow({ ...ok, userTurn: 3 }), true);
  });

  test("기능이 꺼져 있으면 절대 제안하지 않는다", () => {
    assert.equal(canOfferNow({ ...ok, enabled: false }), false);
  });

  test("1번째 질문이나 4번째 이후에는 제안하지 않는다", () => {
    assert.equal(canOfferNow({ ...ok, userTurn: 1 }), false);
    assert.equal(canOfferNow({ ...ok, userTurn: 4 }), false);
  });

  test("임상·위기·폭력·서비스 문의 경로에서는 절대 제안하지 않는다", () => {
    for (const route of ["crisis", "violence", "clinical_diagnosis", "clinical_distress", "service_info"] as const) {
      assert.equal(canOfferNow({ ...ok, route }), false, route);
      assert.equal(isDialogueRouteAllowed(route), false, route);
    }
    assert.equal(isDialogueRouteAllowed("life_decision"), true);
  });

  test("성향 질문 모드에서는 제안하지 않는다", () => {
    assert.equal(canOfferNow({ ...ok, isPersonaQuestion: true }), false);
  });

  test("이미 제안했으면 다시 제안하지 않는다(세션당 1회)", () => {
    assert.equal(canOfferNow({ ...ok, state: afterOffer(EMPTY_STATE, 2, "TH-1", []) }), false);
  });
});

describe("getTheoryConfig", () => {
  test("기본값은 꺼짐이다", () => {
    assert.equal(getTheoryConfig({}).enabled, false);
    assert.equal(getTheoryConfig({ THEORY_OFFER_ENABLED: "false" }).enabled, false);
    assert.equal(getTheoryConfig({ THEORY_OFFER_ENABLED: "1" }).enabled, false); // 정확히 "true"만 켜짐
  });

  test("THEORY_OFFER_ENABLED=true일 때만 켜지고, 기준값은 env로 조정된다", () => {
    const c = getTheoryConfig({ THEORY_OFFER_ENABLED: "true", THEORY_MATCH_MIN_SCORE: "0.6", THEORY_MATCH_MARGIN: "x" });
    assert.equal(c.enabled, true);
    assert.equal(c.matcher.minScore, 0.6);
    assert.equal(c.matcher.margin, 0.03); // 숫자가 아니면 기본값
  });
});
