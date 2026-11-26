import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { pickLatestTest, type LatestCandidate, type LatestTest } from "./testOpeningSource";

type Admin = ReturnType<typeof createAdminClient>;

// 이 사람이 가장 최근에 본 테스트(타로·점성술·디저트 유형) — 대표님 2026-11-26 "여러 개 본 사람은 제일 최근 테스트 기준으로".
// 타로·점성술은 채팅에 넘길 요약(chat_summary)이 있는 결과만 센다. 각 표는 다른 앱 소유라 읽기만 하고, 못 읽으면 그 테스트는 없는 것으로 본다.
async function latestOf(q: PromiseLike<{ data: unknown; error: { code?: string } | null }>, kind: LatestCandidate["kind"]): Promise<LatestCandidate | null> {
  try {
    const { data, error } = await q;
    if (error) {
      console.warn(`최근 ${kind} 결과 조회 실패:`, error.code);
      return null;
    }
    const r = data as { id?: string | number; created_at?: string } | null;
    return r?.id != null && r.created_at ? { kind, id: String(r.id), at: r.created_at } : null;
  } catch {
    return null;
  }
}

export async function loadLatestTest(admin: Admin, userId: string): Promise<LatestTest | null> {
  const [tarot, astro, quiz] = await Promise.all([
    latestOf(admin.from("tarot_sessions").select("id, created_at").eq("user_id", userId).not("chat_summary", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle(), "tarot"),
    latestOf(admin.from("astro_results").select("id, created_at").eq("user_id", userId).not("chat_summary", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle(), "astro"),
    latestOf(admin.from("ssol_quiz_results").select("id, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(), "quiz"),
  ]);
  return pickLatestTest([tarot, astro, quiz]);
}

// 타로에서 직접 적은 고민(가장 최근) — 다른 테스트 기준 첫 메시지에도 그 사람의 고민을 함께 짚으려고(대표님 2026-11-26).
export async function loadLatestTarotWorry(admin: Admin, userId: string): Promise<string | null> {
  try {
    const { data, error } = await admin.from("tarot_sessions").select("worry_text").eq("user_id", userId).not("worry_text", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) return null;
    const t = ((data as { worry_text?: string } | null)?.worry_text ?? "").trim();
    return t ? t.slice(0, 600) : null;
  } catch {
    return null;
  }
}
