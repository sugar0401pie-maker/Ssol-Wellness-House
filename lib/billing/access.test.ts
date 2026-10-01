import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeAccess } from "./access.ts";

describe("computeAccess", () => {
  test("가입 직후(무료체험 7일 이내, 심층보고서 있음)는 허용된다", () => {
    const now = new Date("2026-09-10T00:00:00Z");
    const result = computeAccess({ trialStartedAt: "2026-09-05T00:00:00Z", entitlements: [], hasReport: true, now });
    assert.equal(result.allowed, true);
    if (result.allowed) assert.equal(result.reason, "trial");
  });

  test("가입 후 정확히 7일이 지나면(심층보고서 있음) 무료체험이 끝난다", () => {
    const now = new Date("2026-09-12T00:00:01Z");
    const result = computeAccess({ trialStartedAt: "2026-09-05T00:00:00Z", entitlements: [], hasReport: true, now });
    assert.equal(result.allowed, false);
  });

  test("무료체험이 끝났어도 활성 이용권이 있으면 허용된다", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    const result = computeAccess({
      trialStartedAt: "2026-09-01T00:00:00Z",
      entitlements: [{ status: "active", expiresAt: "2026-11-01T00:00:00Z" }],
      hasReport: true,
      now,
    });
    assert.equal(result.allowed, true);
    if (result.allowed) assert.equal(result.reason, "entitlement");
  });

  test("이용권이 있어도 만료일이 지났으면 무료체험 여부로만 판단한다", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    const result = computeAccess({
      trialStartedAt: "2026-09-01T00:00:00Z",
      entitlements: [{ status: "active", expiresAt: "2026-09-20T00:00:00Z" }],
      hasReport: true,
      now,
    });
    assert.equal(result.allowed, false);
  });

  test("pending(신청만 접수, 아직 확인 전) 이용권은 접근을 허용하지 않는다", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    const result = computeAccess({
      trialStartedAt: "2026-09-01T00:00:00Z",
      entitlements: [{ status: "pending", expiresAt: null }],
      hasReport: true,
      now,
    });
    assert.equal(result.allowed, false);
  });

  test("만료일이 없는(expiresAt: null) 활성 이용권은 계속 허용된다", () => {
    const now = new Date("2027-01-01T00:00:00Z");
    const result = computeAccess({
      trialStartedAt: "2026-01-01T00:00:00Z",
      entitlements: [{ status: "active", expiresAt: null }],
      hasReport: true,
      now,
    });
    assert.equal(result.allowed, true);
  });

  test("trialEndsAt은 가입일 기준 정확히 7일 뒤이고(심층보고서 있음), 결제 여부와 무관하게 항상 계산된다", () => {
    const now = new Date("2026-09-10T00:00:00Z");
    const withEntitlement = computeAccess({
      trialStartedAt: "2026-09-05T00:00:00Z",
      entitlements: [{ status: "active", expiresAt: null }],
      hasReport: true,
      now,
    });
    assert.equal(withEntitlement.trialEndsAt, "2026-09-12T00:00:00.000Z");
    const withoutEntitlement = computeAccess({
      trialStartedAt: "2026-09-05T00:00:00Z",
      entitlements: [],
      hasReport: true,
      now,
    });
    assert.equal(withoutEntitlement.trialEndsAt, "2026-09-12T00:00:00.000Z");
  });

  test("entitlementExpiresAt은 활성 이용권으로 허용된 경우에만 그 이용권의 만료일을 담고, 그 외엔 null이다", () => {
    const now = new Date("2026-09-10T00:00:00Z");
    const entitlementCase = computeAccess({
      trialStartedAt: "2026-01-01T00:00:00Z",
      entitlements: [{ status: "active", expiresAt: "2026-12-01T00:00:00Z" }],
      hasReport: true,
      now,
    });
    assert.equal(entitlementCase.entitlementExpiresAt, "2026-12-01T00:00:00Z");

    const trialCase = computeAccess({
      trialStartedAt: "2026-09-05T00:00:00Z",
      entitlements: [],
      hasReport: true,
      now,
    });
    assert.equal(trialCase.entitlementExpiresAt, null);

    const expiredCase = computeAccess({
      trialStartedAt: "2026-01-01T00:00:00Z",
      entitlements: [],
      hasReport: true,
      now,
    });
    assert.equal(expiredCase.entitlementExpiresAt, null);
  });

  // 2026-10-01 owner 결정: 심층보고서 보유 여부로 무료체험이 7일/3일로 갈린다.
  describe("심층보고서 보유 여부에 따른 무료체험 일수", () => {
    test("심층보고서가 없으면 3일만 체험이고, 3일이 지나면 끝난다", () => {
      const now = new Date("2026-09-08T00:00:01Z");
      const result = computeAccess({
        trialStartedAt: "2026-09-05T00:00:00Z",
        entitlements: [],
        hasReport: false,
        now,
      });
      assert.equal(result.allowed, false);
      assert.equal(result.trialDays, 3);
      assert.equal(result.trialEndsAt, "2026-09-08T00:00:00.000Z");
    });

    test("심층보고서가 없어도 3일 이내면 허용된다", () => {
      const now = new Date("2026-09-07T00:00:00Z");
      const result = computeAccess({
        trialStartedAt: "2026-09-05T00:00:00Z",
        entitlements: [],
        hasReport: false,
        now,
      });
      assert.equal(result.allowed, true);
      assert.equal(result.trialDays, 3);
    });

    test("심층보고서가 있으면(같은 가입일이라도) 7일까지 허용된다 — 3일째에도 아직 체험 중", () => {
      const now = new Date("2026-09-08T00:00:01Z");
      const result = computeAccess({
        trialStartedAt: "2026-09-05T00:00:00Z",
        entitlements: [],
        hasReport: true,
        now,
      });
      assert.equal(result.allowed, true);
      assert.equal(result.trialDays, 7);
    });
  });
});
