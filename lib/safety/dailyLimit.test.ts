import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { startOfTodayKST } from "./dailyLimit.ts";

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
