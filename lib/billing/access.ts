// 순수 함수로 분리해 네트워크 없이 단위 테스트한다 (access.test.ts).
import { TRIAL_DAYS } from "./pricing.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export type Entitlement = { status: "pending" | "active" | "canceled" | "expired"; expiresAt: string | null };

export type AccessResult =
  | { allowed: true; reason: "entitlement" | "trial"; trialDaysLeft: number }
  | { allowed: false; reason: "expired"; trialDaysLeft: 0 };

// entitlements 중 하나라도 지금 유효하게 활성 상태면(만료일이 없거나 아직 안 지났으면) 그걸로 허용한다.
// 아니면 가입일(trialStartedAt) 기준 7일 무료체험이 아직 안 끝났는지 본다.
export function computeAccess(params: {
  trialStartedAt: string;
  entitlements: Entitlement[];
  now: Date;
}): AccessResult {
  const { trialStartedAt, entitlements, now } = params;

  const hasActiveEntitlement = entitlements.some(
    (e) => e.status === "active" && (!e.expiresAt || new Date(e.expiresAt) > now),
  );
  if (hasActiveEntitlement) return { allowed: true, reason: "entitlement", trialDaysLeft: 0 };

  const trialEnd = new Date(trialStartedAt).getTime() + TRIAL_DAYS * DAY_MS;
  if (now.getTime() < trialEnd) {
    const trialDaysLeft = Math.max(1, Math.ceil((trialEnd - now.getTime()) / DAY_MS));
    return { allowed: true, reason: "trial", trialDaysLeft };
  }

  return { allowed: false, reason: "expired", trialDaysLeft: 0 };
}
