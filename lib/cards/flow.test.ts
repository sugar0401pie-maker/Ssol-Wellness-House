import { test } from "node:test";
import assert from "node:assert/strict";
import { CARD_ROUTES, cardPayload, cardsEnabled, confirmPayload, offerExpired, parseCardPick, tapMarker, toEnginePick } from "./flow.ts";

test("기본은 켜짐 · 0이면 꺼짐 · 허용 목록이 있으면 그 사람만", () => {
  assert.equal(cardsEnabled({}, "u1"), true);
  assert.equal(cardsEnabled({ SW_CARDS_ENABLED: "1" }, "u1"), true);
  assert.equal(cardsEnabled({ SW_CARDS_ENABLED: "0" }, "u1"), false);
  assert.equal(cardsEnabled({ SW_CARDS_ENABLED: "0", SW_CARDS_ALLOWLIST: "u1" }, "u1"), false);
  assert.equal(cardsEnabled({ SW_CARDS_ALLOWLIST: "u2,a@b.com" }, "u1"), false);
  assert.equal(cardsEnabled({ SW_CARDS_ALLOWLIST: "u2,a@b.com" }, "u1", "A@B.com"), true);
});

test("카드를 여는 경로는 일상 고민·삶의 결정뿐", () => {
  assert.deepEqual([...CARD_ROUTES].sort(), ["life_decision", "wellness"]);
});

test("요청 값 검사: 모양이 맞는 것만 받는다", () => {
  assert.deepEqual(parseCardPick({ cardId: "CC-GRP-1", optionId: "GO-1-PERF" }), { cardId: "CC-GRP-1", optionId: "GO-1-PERF" });
  assert.deepEqual(parseCardPick({ cardId: "CC-GRP-1", dk: true }), { cardId: "CC-GRP-1", dk: true });
  assert.deepEqual(parseCardPick({ cardId: "CC-GRP-1", other: true }), { cardId: "CC-GRP-1", other: true });
  assert.deepEqual(parseCardPick({ cardId: "CC-GRP-1", multi: ["GO-1-PERF", "GO-1-PEOPLE"] }), { cardId: "CC-GRP-1", multi: ["GO-1-PERF", "GO-1-PEOPLE"] });
  assert.deepEqual(parseCardPick({ confirm: "CF-2" }), { confirm: "CF-2" });
  for (const bad of [null, "x", {}, { cardId: "CC-GRP-1" }, { cardId: "bad id!", optionId: "GO-1" }, { cardId: "CC-GRP-1", optionId: "x; drop" }, { cardId: "CC-GRP-1", multi: ["A1", "A1"] }, { cardId: "CC-GRP-1", multi: ["A1"] }, { cardId: "CC-GRP-1", multi: ["AA", "BB", "CC"] }, { confirm: "CF-9" }])
    assert.equal(parseCardPick(bad), null, JSON.stringify(bad));
});

test("엔진 입력으로 변환", () => {
  assert.deepEqual(toEnginePick({ cardId: "C1", optionId: "O1" }, ""), { optionId: "O1" });
  assert.deepEqual(toEnginePick({ cardId: "C1", dk: true }, ""), { dk: true });
  assert.deepEqual(toEnginePick({ cardId: "C1", other: true }, "x".repeat(500)).other?.toString().length, 200);
  assert.deepEqual(toEnginePick({ cardId: "C1", multi: ["A1", "B1"] }, ""), { multi: ["A1", "B1"] });
  assert.equal(tapMarker({ cardId: "CC-GRP-1", optionId: "O1" }), "sw-cardtap:CC-GRP-1");
  assert.equal(tapMarker({ confirm: "CF-1" }), "sw-cardtap:CF-1");
});

test("화면에 보낼 모양: 카드는 보기 + 고정 보기, 확인은 보기만", () => {
  const p = cardPayload({ card: { id: "CC-GRP-1", lead: "이유를 골라 줄래요?" }, options: [{ id: "A", text: "가" }], fixed: [{ id: "FX-MULTI", text: "두 개" }, { id: "FX-DK", text: "몰라" }, { id: "FX-OTHER", text: "다른" }, { id: "FX-X", text: "무시" }] });
  assert.deepEqual(p.fixed.map((f) => f.id), ["FX-MULTI", "FX-DK", "FX-OTHER"]);
  assert.equal(p.kind, "card");
  const c = confirmPayload("“…” — 어때요?", [{ id: "CF-1", text: "맞아요" }]);
  assert.deepEqual([c.kind, c.cardId, c.fixed.length], ["confirm", "CC-CONFIRM", 0]);
});

test("장면을 감지한 지 15분이 넘으면 카드를 꺼내지 않는다", () => {
  const now = Date.parse("2026-10-20T12:00:00Z");
  assert.equal(offerExpired("2026-10-20T11:50:00Z", now), false);
  assert.equal(offerExpired("2026-10-20T11:40:00Z", now), true);
});
