import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

// 화면에서 부를 이름(2026-11-24 — 홈 인사말과 "○○님과의 대화에서 읽은 것들"이 같이 쓴다).
// 닉네임 → 가입 때 적은 실명 → 카카오·네이버가 넘겨준 이름(user_metadata.name·full_name) 순. 없으면 null(이름 없이 말한다).
type Admin = ReturnType<typeof createAdminClient>;

export async function loadGreetingName(admin: Admin, userId: string, profile?: { nickname?: string | null; display_name?: string | null } | null): Promise<string | null> {
  let p = profile;
  if (p === undefined) {
    const { data } = await admin.from("profiles").select("nickname, display_name").eq("user_id", userId).maybeSingle();
    p = data;
  }
  const own = p?.nickname?.trim() || p?.display_name?.trim();
  if (own) return own;
  const { data: au } = await admin.auth.admin.getUserById(userId).catch(() => ({ data: null }));
  const meta = au?.user?.user_metadata as Record<string, unknown> | undefined;
  const n = (typeof meta?.name === "string" && meta.name.trim()) || (typeof meta?.full_name === "string" && meta.full_name.trim()) || "";
  return n ? n.slice(0, 20) : null;
}
