import { test } from "node:test";
import assert from "node:assert/strict";
import { FLYING_CAPTIONS, CAPTION_MS, SCENE_MS, isLanternOpen, lanternEventKey, lanternPeriod, normalizeWish, WISH_MAX } from "./config.ts";

test("이벤트 기간: 기본 11/25~12/31(양끝 포함), 환경 변수로 바꿀 수 있고 형식이 틀리면 기본값", () => {
  const p = lanternPeriod();
  assert.deepEqual(p, { start: "2026-11-25", end: "2026-12-31" });
  assert.equal(isLanternOpen("2026-11-24", p), false);
  assert.equal(isLanternOpen("2026-11-25", p), true);
  assert.equal(isLanternOpen("2026-12-31", p), true);
  assert.equal(isLanternOpen("2027-01-01", p), false);
  assert.deepEqual(lanternPeriod({ SW_LANTERN_START: "2026-11-20", SW_LANTERN_END: "bad" }), { start: "2026-11-20", end: "2026-12-31" });
});

test("소원 글: 공백 정리, 비었거나 40자를 넘으면 받지 않음(한글·이모지도 한 글자)", () => {
  assert.equal(normalizeWish("  올해는\n  건강하게  "), "올해는 건강하게");
  assert.equal(normalizeWish("   "), null);
  assert.equal(normalizeWish(123), null);
  assert.equal(normalizeWish("가".repeat(WISH_MAX)), "가".repeat(WISH_MAX));
  assert.equal(normalizeWish("가".repeat(WISH_MAX + 1)), null);
});

test("한 번만 날리는 단위는 이벤트 시작일로 정해진다(기간을 새로 정하면 다시 날릴 수 있음)", () => {
  assert.equal(lanternEventKey(lanternPeriod()), "lantern-2026-11-25");
  assert.equal(lanternEventKey({ start: "2027-01-01" }), "lantern-2027-01-01");
});

test("날리는 동안 안내 문구: 2초마다, 장면이 끝날 때까지 한 바퀴를 다 보여 줄 만큼", () => {
  assert.equal(CAPTION_MS, 2000);
  assert.equal(FLYING_CAPTIONS[0], "소중한 마음을 풍등에 담고 있어요…");
  assert.ok(FLYING_CAPTIONS.length * CAPTION_MS <= SCENE_MS[2] + SCENE_MS[3] + SCENE_MS[4]);
});
