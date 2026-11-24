import { test } from "node:test";
import assert from "node:assert/strict";
import { onboardingPromptDue, dayOfUseKST } from "./promptTiming.ts";

test("쓰기 시작한 날이 1일차 — 한국 날짜로 센다", () => {
  // 11-22 23:30 KST(= 14:30 UTC)에 시작 → 11-23 00:10 KST는 2일차
  assert.equal(dayOfUseKST("2026-11-22T14:30:00Z", new Date("2026-11-22T15:10:00Z")), 2);
  assert.equal(dayOfUseKST("2026-11-22T01:00:00Z", new Date("2026-11-22T10:00:00Z")), 1);
  assert.equal(dayOfUseKST("2026-11-22T01:00:00Z", new Date("2026-11-24T01:00:00Z")), 3);
  assert.equal(dayOfUseKST(null), null);
  assert.equal(dayOfUseKST("이상한 값"), null);
});

test("온보딩 권유는 3일차부터, 아직 안 한 사람에게만(시작일을 모르면 하지 않음)", () => {
  assert.equal(onboardingPromptDue({ needsOnboarding: true, useDay: 2 }), false);
  assert.equal(onboardingPromptDue({ needsOnboarding: true, useDay: 3 }), true);
  assert.equal(onboardingPromptDue({ needsOnboarding: true, useDay: 10 }), true);
  assert.equal(onboardingPromptDue({ needsOnboarding: false, useDay: 5 }), false);
  assert.equal(onboardingPromptDue({ needsOnboarding: true, useDay: null }), false);
});
