import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { computeAccess, decideTrialStart, type AccessResult } from "./access";

// 2026-10-17 owner 결정: 무료체험 시작일은 계정이 만들어진 날(profiles.created_at)이 아니라 "쏘웰라에 처음 직접
// 들어온 날"(profiles.trial_started_at)이다 — 계정은 다른 앱과 공유라 다른 곳에서 계정만 만들어도 체험 기간이 흘러가던 문제.
// 이 함수는 채팅·이용권 조회 같은 로그인한 실제 계정의 요청에서만 불린다(익명 토큰은 API 앞단에서 거부됨).
// 값이 비어 있으면 지금이 첫 접속이라 지금을 시작으로 한 번만 기록한다(동시에 두 요청이 와도 먼저 쓴 값만 남는다).
// 그 칸이 아직 없으면(마이그레이션 전) 예전처럼 가입일을 쓴다.
// 가입일을 못 찾으면(정상적으로는 signup 트리거가 항상 만들어주므로 일어나지 않아야 함) fail-safe로 접근을 막지 않고
// 오늘을 시작일로 취급한다 — 결제 게이트가 오작동해서 정상 사용자를 막는 쪽보다,
// 드문 데이터 누락 때문에 하루 더 무료로 열어주는 쪽이 안전하다.
//
// 2026-10-01 owner 결정: 심층보고서(ssol_reports, status='ready') 보유 여부로 무료체험
// 일수를 7일/3일로 차등 적용한다 — ssol_reports는 형제 퀴즈 앱 소유 테이블이라 읽기만 한다
// (CLAUDE.md 규칙). 조회가 실패해도(네트워크 등) hasReport=false로 안전하게 넘어간다 —
// "원래 받아야 할 7일 대신 3일만 준다"는 쪽이 "원래 3일인데 7일을 잘못 준다"보다 덜 위험하다.
export async function loadAccessStatus(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<AccessResult> {
  const [
    { data: profile, error: profileError },
    { data: entitlements, error: entitlementsError },
    { data: reportRow, error: reportError },
  ] = await Promise.all([
    admin.from("profiles").select("created_at, trial_started_at").eq("user_id", userId).maybeSingle(),
    admin.from("chat_entitlements").select("status, expires_at").eq("user_id", userId),
    admin.from("ssol_reports").select("id").eq("user_id", userId).eq("status", "ready").limit(1).maybeSingle(),
  ]);
  // CLAUDE.md 교훈(2026-09-25 등, 이미 두 차례 재발): data만 보고 error를 버리지 않는다 —
  // 여기서는 조회가 실패해도 무료체험 판정으로 안전하게 넘어가지만(fail-safe), 원인은 로그로 남긴다.
  // trial_started_at 칸이 아직 없는 경우(마이그레이션 전)에는 가입일만 다시 읽어 예전 방식으로 동작한다.
  let createdAt: string | null = profile?.created_at ?? null;
  const trialStartedAtRaw: string | null = profile?.trial_started_at ?? null;
  let columnAvailable = !profileError;
  if (profileError) {
    console.error("profiles(체험 시작일) 조회 실패:", profileError.message);
    const { data: legacy } = await admin.from("profiles").select("created_at").eq("user_id", userId).maybeSingle();
    createdAt = legacy?.created_at ?? null;
    columnAvailable = false;
  }
  if (entitlementsError) console.error("chat_entitlements 조회 실패:", entitlementsError.message);
  if (reportError) console.error("ssol_reports(심층보고서 보유 여부) 조회 실패:", reportError.message);

  const now = new Date();
  // 프로필 행이 아예 없으면 기록할 곳도 없으므로 예전처럼 "지금부터"로만 판정한다(기록 시도 안 함).
  const profileExists = createdAt !== null || trialStartedAtRaw !== null;
  const decision = decideTrialStart({ columnAvailable: columnAvailable && profileExists, trialStartedAt: trialStartedAtRaw, createdAt, now });
  let trialStartedAt = decision.startedAt;
  if (decision.stamp) {
    // 첫 접속 기록: 아직 비어 있을 때만 채운다(.is null) — 동시에 온 다른 요청이 먼저 썼다면 그 값을 따른다.
    const { data: stamped, error: stampError } = await admin
      .from("profiles")
      .update({ trial_started_at: decision.startedAt })
      .eq("user_id", userId)
      .is("trial_started_at", null)
      .select("trial_started_at")
      .maybeSingle();
    if (stampError) {
      console.error("profiles.trial_started_at 기록 실패:", stampError.message);
    } else if (!stamped) {
      const { data: winner } = await admin.from("profiles").select("trial_started_at").eq("user_id", userId).maybeSingle();
      if (winner?.trial_started_at) trialStartedAt = winner.trial_started_at;
    }
  }
  return computeAccess({
    trialStartedAt,
    entitlements: (entitlements ?? []).map((e) => ({
      status: e.status as "pending" | "active" | "canceled" | "expired",
      expiresAt: e.expires_at,
    })),
    hasReport: !!reportRow,
    now,
  });
}
