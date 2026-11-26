import { test } from "node:test";
import assert from "node:assert/strict";
import { tarotPlanFrom } from "./tarotPlan.ts";

test("타로 다섯 칸: 글 한 줄 또는 {title, description}", () => {
  const p = tarotPlanFrom({ challenge: { day1: "걱정 세 줄 적기", day2: { title: "10분 걷기", description: "점심 뒤에" }, day3: { title: "돌아보기" }, week: "주 3번 걷기" } });
  assert.equal(p?.day1.title, "걱정 세 줄 적기");
  assert.equal(p?.day2.description, "점심 뒤에");
  assert.equal(p?.week?.title, "주 3번 걷기");
  assert.equal(p?.month, null);
});

test("1·2·3일차 중 하나라도 없으면 계획으로 보지 않는다", () => {
  assert.equal(tarotPlanFrom({ challenge: { day1: "a", day2: "b" } }), null);
  assert.equal(tarotPlanFrom({}), null);
  assert.equal(tarotPlanFrom(null), null);
  assert.equal(tarotPlanFrom({ challenge: { day1: "", day2: "b", day3: "c" } }), null);
});

test("너무 긴 제목은 버리고, 이상한 practice_id는 비운다", () => {
  assert.equal(tarotPlanFrom({ challenge: { day1: "가".repeat(81), day2: "b", day3: "c" } }), null);
  const p = tarotPlanFrom({ challenge: { day1: { title: "a", practice_id: "x y;drop" }, day2: "b", day3: "c" } });
  assert.equal(p?.day1.practice_id, null);
});
