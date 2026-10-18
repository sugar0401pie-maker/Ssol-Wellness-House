import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { isInterpEnabled } from "./gate";

const emailCache = new Map<string, string | null>();
async function emailOf(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
  if (emailCache.has(userId)) return emailCache.get(userId)!;
  const { data } = await admin.auth.admin.getUserById(userId);
  const email = data?.user?.email ?? null;
  emailCache.set(userId, email);
  return email;
}

// 해석 기능 대상 사용자인지(끄기 스위치·허용 목록). 목록이 없으면 전체이므로 이메일 조회 없이 통과하고, 목록이 있을 때만 이메일을 확인한다.
export async function interpListed(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<boolean> {
  const env = process.env as { SW_INTERP_ENABLED?: string; SW_INTERP_ALLOWLIST?: string };
  if (env.SW_INTERP_ENABLED === "0") return false;
  return isInterpEnabled(env, userId) || (!!env.SW_INTERP_ALLOWLIST?.trim() && isInterpEnabled(env, userId, await emailOf(admin, userId)));
}

