import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { EXTENSION_CHOICES, EXTENSION_LEAD, OFFER_CHOICES, OFFER_LEAD, buildOfferMessage, choicesForMessage, isExtensionMessage, isOfferMessage } from "./offer.ts";

describe("선택 안내 문구", () => {
  test("owner 지정 문장 앞부분과 두 칩 글자는 그대로", () => {
    assert.equal(OFFER_LEAD, "지금 당장 시도해보실 수 있는 마음이 나아지는 방법을 알려드릴까요?");
    assert.deepEqual(OFFER_CHOICES.map((c) => c.label), ["행동 제안받기", "내 고민 더 알아보기"]);
    assert.equal(buildOfferMessage("민지"), `${OFFER_LEAD} 아니면 조금 더 웰니스 관점에서 민지님의 고민에 대해 깊게 알아보시겠어요?`);
  });
  test("닉네임이 없으면 '회원'", () => {
    assert.match(buildOfferMessage(null), /회원님의 고민/);
    assert.match(buildOfferMessage("  "), /회원님의 고민/);
  });
  test("저장된 대화를 다시 열었을 때 어떤 안내인지 알아본다", () => {
    assert.equal(isOfferMessage(buildOfferMessage("민지")), true);
    assert.equal(isExtensionMessage(EXTENSION_LEAD), true);
    assert.equal(isOfferMessage("안녕하세요"), false);
    assert.equal(choicesForMessage(buildOfferMessage("민지")), OFFER_CHOICES);
    assert.equal(choicesForMessage(EXTENSION_LEAD), EXTENSION_CHOICES);
    assert.equal(choicesForMessage("평범한 답변"), null);
  });
  test("연장 칩은 '이걸로 해볼게요' / '조금 더 이야기할래요'", () => {
    assert.deepEqual(EXTENSION_CHOICES.map((c) => c.id), ["finish", "extend"]);
  });
});
