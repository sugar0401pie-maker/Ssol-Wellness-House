import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { computeAccess, type AccessResult } from "./access";

// profiles.created_at(가입일)을 무료체험 시작일로 쓴다. 가입일을 못 찾으면(정상적으로는
// signup 트리거가 항상 만들어주므로 일어나지 않아야 함) fail-safe로 접근을 막지 않고
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
    admin.from("profiles").select("created_at").eq("user_id", userId).maybeSingle(),
    admin.from("chat_entitlements").select("status, expires_at").eq("user_id", userId),
    admin.from("ssol_reports").select("id").eq("user_id", userId).eq("status", "ready").limit(1).maybeSingle(),
  ]);
  // CLAUDE.md 교훈(2026-09-25 등, 이미 두 차례 재발): data만 보고 error를 버리지 않는다 —
  // 여기서는 조회가 실패해도 무료체험 판정으로 안전하게 넘어가지만(fail-safe), 원인은 로그로 남긴다.
  if (profileError) console.error("profiles(가입일) 조회 실패:", profileError.message);
  if (entitlementsError) console.error("chat_entitlements 조회 실패:", entitlementsError.message);
  if (reportError) console.error("ssol_reports(심층보고서 보유 여부) 조회 실패:", reportError.message);

  const trialStartedAt = profile?.created_at ?? new Date().toISOString();
  return computeAccess({
    trialStartedAt,
    entitlements: (entitlements ?? []).map((e) => ({
      status: e.status as "pending" | "active" | "canceled" | "expired",
      expiresAt: e.expires_at,
    })),
    hasReport: !!reportRow,
    now: new Date(),
  });
}
