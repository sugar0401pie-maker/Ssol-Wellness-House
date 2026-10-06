import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { passesServingRules } from "./servingRules.ts";

const calm = { hasCrisisHistory: false };

describe("passesServingRules — 이론 기반 실천 노출 제한", () => {
  test("기존 실천(기본값: general, exposure 아님)은 항상 통과한다", () => {
    assert.equal(passesServingRules({}, calm), true);
    assert.equal(passesServingRules({ availability: "general", exposureFlag: false }, { hasCrisisHistory: true }), true);
    assert.equal(passesServingRules({ availability: null, exposureFlag: null, exposureStep: null }, calm), true);
  });

  test("after_explore는 탐색 대화가 허용되기 전까지 어디서도 안 나간다", () => {
    assert.equal(passesServingRules({ availability: "after_explore" }, calm), false);
    assert.equal(passesServingRules({ availability: "after_explore" }, { ...calm, allowAfterExplore: true }), true);
  });

  test("exposure는 위기 이력 계정에는 단계와 상관없이 전부 제외", () => {
    assert.equal(passesServingRules({ exposureFlag: true, exposureStep: 1 }, { hasCrisisHistory: true }), false);
    assert.equal(passesServingRules({ exposureFlag: true, exposureStep: 2 }, { hasCrisisHistory: true, maxExposureStep: 3 }), false);
  });

  test("위기 이력이 없으면 1단계만 열고, 2단계 이상은 막는다(완료 기록이 생기기 전까지)", () => {
    assert.equal(passesServingRules({ exposureFlag: true, exposureStep: 1 }, calm), true);
    assert.equal(passesServingRules({ exposureFlag: true, exposureStep: 2 }, calm), false);
    assert.equal(passesServingRules({ exposureFlag: true, exposureStep: 3 }, calm), false);
    assert.equal(passesServingRules({ exposureFlag: true, exposureStep: 2 }, { ...calm, maxExposureStep: 2 }), true);
  });

  test("exposure인데 단계가 비어 있으면 내보내지 않는다(fail-safe)", () => {
    assert.equal(passesServingRules({ exposureFlag: true, exposureStep: null }, calm), false);
    assert.equal(passesServingRules({ exposureFlag: true }, calm), false);
  });

  test("트라우마 대화(excludeExposure)에서는 1단계 exposure도 뺀다", () => {
    assert.equal(passesServingRules({ exposureFlag: true, exposureStep: 1 }, { ...calm, excludeExposure: true }), false);
    assert.equal(passesServingRules({ exposureFlag: false }, { ...calm, excludeExposure: true }), true);
  });
});
