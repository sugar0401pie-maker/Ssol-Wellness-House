import { test } from "node:test";
import assert from "node:assert/strict";
import { isLanternOpen, lanternPeriod, normalizeWish, WISH_MAX } from "./config.ts";

test("이벤트 기간: 기본 11/26~12/31(양끝 포함), 환경 변수로 바꿀 수 있고 형식이 틀리면 기본값", () => {
  const p = lanternPeriod();
  assert.deepEqual(p, { start: "2026-11-26", end: "2026-12-31" });
  assert.equal(isLanternOpen("2026-11-25", p), false);
  assert.equal(isLanternOpen("2026-11-26", p), true);
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
