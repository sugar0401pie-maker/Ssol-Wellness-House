import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { extractAstroGreeting } from "@/lib/persona/astroGreeting";

// 점성술 결과의 맞춤 첫 인사 문장(lib/persona/astroGreeting.ts 참고). astro_results는 점성술 앱 소유라 읽기만 하고,
// 결과 id가 오면 그 결과가 이 사용자 것일 때만, 없으면 이 사용자의 가장 최근 결과에서 꺼낸다. 실패하면 null(기본 인사).
export async function loadAstroGreeting(admin: ReturnType<typeof createAdminClient>, userId: string, resultId: string | null): Promise<string | null> {
  let q = admin.from("astro_results").select("chat_summary").eq("user_id", userId).not("chat_summary", "is", null);
  q = resultId ? q.eq("id", resultId) : q.order("created_at", { ascending: false });
  const { data, error } = await q.limit(1).maybeSingle();
  if (error) {
    console.warn("점성술 첫 인사 조회 실패:", error.code);
    return null;
  }
  return extractAstroGreeting((data as { chat_summary?: unknown } | null)?.chat_summary);
}
