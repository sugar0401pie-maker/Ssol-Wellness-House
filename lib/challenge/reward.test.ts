import { test } from "node:test";
import assert from "node:assert/strict";
import { REWARD_PROMISE, kstMonthDay, rewardGrantedLine, rewardMinStart } from "./reward.ts";

test("무료체험 중이면 7일권은 체험이 끝난 뒤부터", () => {
  assert.equal(rewardMinStart({ reason: "trial", trialEndsAt: "2026-11-29T03:00:00.000Z" }), "2026-11-29T03:00:00.000Z");
});

test("이용권 중·체험 끝이면 하한 없음(이용권 끝 뒤 붙이기는 DB가 한다)", () => {
  assert.equal(rewardMinStart({ reason: "entitlement", trialEndsAt: "2026-11-29T03:00:00.000Z" }), null);
  assert.equal(rewardMinStart({ reason: "expired", trialEndsAt: "2026-11-01T03:00:00.000Z" }), null);
});

test("만료일은 한국 날짜로(UTC 밤 → 한국 다음 날)", () => {
  assert.equal(kstMonthDay("2026-12-03T16:30:00.000Z"), "12월 4일");
  assert.equal(kstMonthDay("2026-12-03T05:00:00.000Z"), "12월 3일");
});

test("지급 문구", () => {
  assert.equal(rewardGrantedLine("2026-12-03T05:00:00.000Z"), "리워드로 쏘웰라 7일권을 드렸어요! 12월 3일까지 쏘웰라와 이야기할 수 있어요.");
  assert.equal(rewardGrantedLine(null), "리워드로 쏘웰라 7일권을 드렸어요!");
  assert.match(REWARD_PROMISE, /7일권/);
});
