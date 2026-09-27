import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { computeAccess, type AccessResult } from "./access";

// profiles.created_at(가입일)을 무료체험 시작일로 쓴다. 가입일을 못 찾으면(정상적으로는
// signup 트리거가 항상 만들어주므로 일어나지 않아야 함) fail-safe로 접근을 막지 않고
// 오늘을 시작일로 취급한다 — 결제 게이트가 오작동해서 정상 사용자를 막는 쪽보다,
// 드문 데이터 누락 때문에 하루 더 무료로 열어주는 쪽이 안전하다.
export async function loadAccessStatus(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<AccessResult> {
  const [{ data: profile, error: profileError }, { data: entitlements, error: entitlementsError }] = await Promise.all([
    admin.from("profiles").select("created_at").eq("user_id", userId).maybeSingle(),
    admin.from("chat_entitlements").select("status, expires_at").eq("user_id", userId),
  ]);
  // CLAUDE.md 교훈(2026-09-25 등, 이미 두 차례 재발): data만 보고 error를 버리지 않는다 —
  // 여기서는 조회가 실패해도 무료체험 판정으로 안전하게 넘어가지만(fail-safe), 원인은 로그로 남긴다.
  if (profileError) console.error("profiles(가입일) 조회 실패:", profileError.message);
  if (entitlementsError) console.error("chat_entitlements 조회 실패:", entitlementsError.message);

  const trialStartedAt = profile?.created_at ?? new Date().toISOString();
  return computeAccess({
    trialStartedAt,
    entitlements: (entitlements ?? []).map((e) => ({
      status: e.status as "pending" | "active" | "canceled" | "expired",
      expiresAt: e.expires_at,
    })),
    now: new Date(),
  });
}
