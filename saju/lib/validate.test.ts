import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanBirth, cleanNickname, cleanAnswers, safeNext } from "./validate.ts";

const NOW = new Date("2026-12-05T12:00:00+09:00");
const base = { calendar: "양력", year: 1996, month: 4, day: 1, timeKnown: true, hour: 10, minute: 17, gender: "여성", region: "서울" };

test("정상 입력은 그대로 통과", () => {
  const b = cleanBirth(base, NOW)!;
  assert.equal(b.year, 1996);
  assert.equal(b.region, "서울");
  assert.equal(b.timeSlot, null);
});

test("없는 날짜·만 14세 미만·이상한 값은 막는다", () => {
  assert.equal(cleanBirth({ ...base, month: 2, day: 30 }, NOW), null);
  assert.equal(cleanBirth({ ...base, year: 2015 }, NOW), null);
  assert.equal(cleanBirth({ ...base, gender: "기타" }, NOW), null);
  assert.equal(cleanBirth({ ...base, hour: 24 }, NOW), null);
  assert.equal(cleanBirth(null, NOW), null);
});

test("시간을 모르면 시간대만 남긴다", () => {
  const b = cleanBirth({ ...base, timeKnown: false, timeSlot: "오후(12~18시)", hour: 99 }, NOW)!;
  assert.equal(b.timeKnown, false);
  assert.equal(b.hour, 0);
  assert.equal(b.timeSlot, "오후(12~18시)");
});

test("닉네임은 1~10자", () => {
  assert.equal(cleanNickname("  하늘  "), "하늘");
  assert.equal(cleanNickname(""), null);
  assert.equal(cleanNickname("가".repeat(11)), null);
});

test("다시 묻기 답은 모양이 맞는 것 2개까지", () => {
  assert.deepEqual(cleanAnswers([{ q: "work", id: "think" }, { q: "x", id: "<b>" }, { q: "a", id: "b" }, { q: "c", id: "d" }]), [
    { q: "work", id: "think" },
    { q: "a", id: "b" },
  ]);
});

test("next는 이 앱 안의 주소만", () => {
  assert.equal(safeNext("/love/worry"), "/love/worry");
  assert.equal(safeNext("//evil.com"), "/");
  assert.equal(safeNext("https://evil.com"), "/");
});
