import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getGreetingLine, holidayPracticeDomain } from "./greeting.ts";

describe("getGreetingLine — 명절/기념일 문법 및 톤 (2026-09-27 회귀 테스트)", () => {
  test("받침 없는 명절 이름(추석 연휴)엔 '예요'가 붙는다 — '이에요'는 문법 오류", () => {
    const line = getGreetingLine("2026-09-24", null);
    assert.match(line, /추석 연휴예요/);
    assert.doesNotMatch(line, /추석 연휴이에요/);
  });

  test("받침 없는 명절 이름(크리스마스)엔 '예요'가 붙고, 크리스마스만의 톤을 쓴다", () => {
    const line = getGreetingLine("2026-12-25", null);
    assert.match(line, /크리스마스예요/);
    assert.match(line, /행복한 하루/);
  });

  test("받침 있는 명절 이름(설날)엔 '이에요'가 붙는다", () => {
    const line = getGreetingLine("2026-02-17", null);
    assert.match(line, /설날이에요/);
  });

  test("어린이날은 명절과 다른 톤(가족·즐거운 시간)을 쓴다", () => {
    const line = getGreetingLine("2026-05-05", null);
    assert.match(line, /어린이날이에요/);
    assert.match(line, /즐거운 시간/);
  });

  test("엄숙한 기념일(삼일절)은 '쉬어가는' 문구 없이 사실만 알린다", () => {
    const line = getGreetingLine("2026-03-01", null);
    assert.equal(line, "오늘은 삼일절이에요.");
  });

  test("명절/어린이날/크리스마스는 모두 실천방법을 '관계' 도메인으로 기울인다", () => {
    assert.equal(holidayPracticeDomain("2026-09-25"), "관계");
    assert.equal(holidayPracticeDomain("2026-05-05"), "관계");
    assert.equal(holidayPracticeDomain("2026-12-25"), "관계");
    assert.equal(holidayPracticeDomain("2026-09-10"), null);
  });
});
