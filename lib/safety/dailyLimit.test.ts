import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { startOfTodayKST, todayKeyKST } from "./dailyLimit.ts";

describe("startOfTodayKST", () => {
  test("KST 자정 직후는 그날 자정(UTC 전날 15시)을 기준으로 삼는다", () => {
    // 2026-01-02 00:30 KST = 2026-01-01 15:30 UTC
    const now = new Date("2026-01-01T15:30:00Z");
    const start = startOfTodayKST(now);
    assert.equal(start.toISOString(), "2026-01-01T15:00:00.000Z"); // 2026-01-02 00:00 KST
  });

  test("KST 자정 직전은 전날 자정을 기준으로 삼는다 (날짜가 안 넘어감)", () => {
    // 2026-01-01 23:59 KST = 2026-01-01 14:59 UTC
    const now = new Date("2026-01-01T14:59:00Z");
    const start = startOfTodayKST(now);
    assert.equal(start.toISOString(), "2025-12-31T15:00:00.000Z"); // 2026-01-01 00:00 KST
  });

  test("같은 KST 하루 안의 서로 다른 시각은 같은 기준 시각을 준다", () => {
    const morning = startOfTodayKST(new Date("2026-06-15T00:10:00Z")); // 09:10 KST
    const night = startOfTodayKST(new Date("2026-06-15T13:50:00Z")); // 22:50 KST
    assert.equal(morning.toISOString(), night.toISOString());
  });
});

describe("todayKeyKST", () => {
  // 2026-09-22 회귀 테스트: startOfTodayKST()의 결과에 .toISOString().slice(0,10)을 쓰면
  // UTC 기준 날짜(하루 전)가 나와버리던 버그. todayKeyKST()는 KST 연/월/일을 직접 계산한다.
  test("KST 자정 직후에도 그날 날짜를 그대로 준다 (전날로 밀리지 않음)", () => {
    // 2026-09-22 00:30 KST = 2026-09-21 15:30 UTC
    assert.equal(todayKeyKST(new Date("2026-09-21T15:30:00Z")), "2026-09-22");
  });

  test("KST 자정 직전은 여전히 그 전날 날짜를 준다", () => {
    // 2026-09-21 23:59 KST = 2026-09-21 14:59 UTC
    assert.equal(todayKeyKST(new Date("2026-09-21T14:59:00Z")), "2026-09-21");
  });
});
