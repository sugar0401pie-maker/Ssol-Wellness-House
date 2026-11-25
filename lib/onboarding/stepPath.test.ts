import { test } from "node:test";
import assert from "node:assert/strict";
import { onboardingStepFrom, onboardingStepPath } from "./stepPath.ts";

test("온보딩 질문마다 주소", () => {
  assert.equal(onboardingStepPath(0, 9), "/onboarding/1");
  assert.equal(onboardingStepPath(8, 9), "/onboarding/9");
  assert.equal(onboardingStepPath(9, 9), "/onboarding/agree");
  assert.equal(onboardingStepFrom("1", 9), 0);
  assert.equal(onboardingStepFrom("9", 9), 8);
  assert.equal(onboardingStepFrom("agree", 9), 9);
  for (const bad of ["0", "10", "01", "x", ""]) assert.equal(onboardingStepFrom(bad, 9), null, bad);
});
