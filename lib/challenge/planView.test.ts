import { test } from "node:test";
import assert from "node:assert/strict";
import { enginePlanView, isStartKey, nextThemeKey, planOf, tarotPlanView, themePlan } from "./planView.ts";
import { tarotPlanFrom } from "./tarotPlan.ts";

test("세 가지 마음 계획은 예전 글 그대로", () => {
  const p = themePlan("delay");
  assert.equal(p.source, "theme");
  assert.equal(p.label, "미루지 않기");
  assert.equal(p.days[0].action, "미루던 일 하나를 5분만 해 보기");
  assert.ok(p.days[0].proof?.startsWith("5분 타이머를 켠 화면 찍어 보기"));
});

test("셔플은 세 가지 마음을 순서대로 돈다", () => {
  assert.equal(nextThemeKey("worry"), "delay");
  assert.equal(nextThemeKey("delay"), "energy");
  assert.equal(nextThemeKey("energy"), "worry");
});

test("엔진 계획: 3일 글이 다 있어야, 3일차는 돌아보기 단계를 한 줄로", () => {
  const raw = {
    family_id: "OUT-WALK", category: "운동",
    day1: { title: "걱정 세 줄 적기", description: "메모장에" },
    day2: { title: "걷다가 15분 쉬다 오기", description: "카페나 벤치" },
    day3: { title: "어제 해 본 「걷다가 15분 쉬다 오기」 돌아보기", steps: ["어땠는지 한 줄", "다음에 바꿀 것 하나"] },
    week: { title: "둘레길 반나절" }, month: null,
  };
  const p = enginePlanView(raw)!;
  assert.equal(p.source, "engine");
  assert.equal(p.label, "운동");
  assert.equal(p.days[2].proof, "어땠는지 한 줄 · 다음에 바꿀 것 하나");
  assert.equal(p.week, "둘레길 반나절");
  assert.equal(p.month, null);
  assert.equal(enginePlanView({ ...raw, day2: null }), null);
  assert.equal(enginePlanView(null), null);
});

test("타로 다섯 칸 → 계획", () => {
  const p = tarotPlanView(tarotPlanFrom({ challenge: { day1: "a", day2: { title: "b", description: "bb" }, day3: "c", month: "m" } })!);
  assert.equal(p.source, "tarot");
  assert.deepEqual(p.days.map((d) => d.action), ["a", "b", "c"]);
  assert.equal(p.days[1].proof, "bb");
  assert.equal(p.month, "m");
});

test("저장된 챌린지: plan이 있으면 그것, 없으면(예전 챌린지) 세 가지 마음", () => {
  const eng = enginePlanView({ day1: { title: "x" }, day2: { title: "y" }, day3: { title: "z" } })!;
  assert.equal(planOf({ theme: "me", plan: eng }).days[1].action, "y");
  assert.equal(planOf({ theme: "energy", plan: null }).label, "기운 챙기기");
  assert.equal(planOf({ theme: "me", plan: { broken: true } }).source, "theme");
});

test("시작 주소 키", () => {
  assert.ok(isStartKey("worry") && isStartKey("me") && isStartKey("tarot"));
  assert.ok(!isStartKey("../x") && !isStartKey(null));
});
