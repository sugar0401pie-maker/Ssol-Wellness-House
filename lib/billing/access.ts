// 순수 함수로 분리해 네트워크 없이 단위 테스트한다 (access.test.ts).
import { TRIAL_DAYS } from "./pricing.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export type Entitlement = { status: "pending" | "active" | "canceled" | "expired"; expiresAt: string | null };

export type AccessResult = {
  allowed: boolean;
  reason: "entitlement" | "trial" | "expired";
  trialDaysLeft: number;
  // 2026-09-28: 마이페이지에 "채팅 무료체험 만료일"을 실제 날짜로 보여주기 위해 추가.
  // trialEndsAt은 결제 여부와 무관하게 항상 계산해서 준다(가입일 + 7일). entitlementExpiresAt은
  // 지금 접근을 허용해준 활성 이용권의 만료일 — 이용권이 없으면(무료체험 중/만료) null이고,
  // 이용권은 있지만 만료일 자체가 없으면(수동 부여한 무제한 계정 등)도 null이다.
  trialEndsAt: string;
  entitlementExpiresAt: string | null;
};

// entitlements 중 하나라도 지금 유효하게 활성 상태면(만료일이 없거나 아직 안 지났으면) 그걸로 허용한다.
// 아니면 가입일(trialStartedAt) 기준 7일 무료체험이 아직 안 끝났는지 본다.
//
// 중요: 이 함수는 오직 "채팅(메시지 생성)을 허용할지"만 결정한다 — 계정 자체나 지난 대화 기록,
// 심층보고서 열람은 이 판정과 완전히 무관하다(app/api/chat/route.ts에서만 이 결과로 채팅 생성을
// 막고, 다른 어떤 라우트도 access.allowed를 확인하지 않는다). "무료체험이 끝나면 계정이
// 잠긴다"는 오해가 있었는데, 실제로는 채팅 기능 하나만 결제 전까지 막힌다.
export function computeAccess(params: {
  trialStartedAt: string;
  entitlements: Entitlement[];
  now: Date;
}): AccessResult {
  const { trialStartedAt, entitlements, now } = params;
  const trialEnd = new Date(trialStartedAt).getTime() + TRIAL_DAYS * DAY_MS;
  const trialEndsAt = new Date(trialEnd).toISOString();

  const activeEntitlement = entitlements.find(
    (e) => e.status === "active" && (!e.expiresAt || new Date(e.expiresAt) > now),
  );
  if (activeEntitlement) {
    return {
      allowed: true,
      reason: "entitlement",
      trialDaysLeft: 0,
      trialEndsAt,
      entitlementExpiresAt: activeEntitlement.expiresAt,
    };
  }

  if (now.getTime() < trialEnd) {
    const trialDaysLeft = Math.max(1, Math.ceil((trialEnd - now.getTime()) / DAY_MS));
    return { allowed: true, reason: "trial", trialDaysLeft, trialEndsAt, entitlementExpiresAt: null };
  }

  return { allowed: false, reason: "expired", trialDaysLeft: 0, trialEndsAt, entitlementExpiresAt: null };
}
