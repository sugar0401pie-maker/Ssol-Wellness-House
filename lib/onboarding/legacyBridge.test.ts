import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { deriveLegacyPreference } from "./legacyBridge.ts";

describe("deriveLegacyPreference — 고민 영역 → 실천방법 domain", () => {
  test("육아와 가족 돌봄은 '관계'가 아니라 별도 '육아' 영역으로 간다(2026-10-05 owner 결정)", () => {
    assert.equal(deriveLegacyPreference({ focus_domains: ["parenting_care"] })?.concern_domain, "육아");
  });

  test("인간관계는 계속 '관계'로 간다", () => {
    assert.equal(deriveLegacyPreference({ focus_domains: ["human_relationships"] })?.concern_domain, "관계");
  });
});
