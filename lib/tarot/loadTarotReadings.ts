import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { TAROT_ORIGIN } from "./catalog";
import { toReading, type TarotReading, type TarotRow } from "./readings";

// 이 사용자 계정에 저장된 쏠 타로 결과(최신순). tarot_sessions는 타로 앱(별도 저장소)이 만든 테이블이라
// 여기서는 읽기만 한다. 고민 원문(worry_text)은 일부러 select하지 않는다.
// 테이블이 아직 없거나(타로 마이그레이션 전) 조회가 실패하면 빈 목록 — 마이페이지·채팅이 멈추지 않게(fail-safe).
// 2026-09-25 교훈대로 error를 버리지 않고 로그로 남긴다.
export async function loadTarotReadings(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  limit = 20,
): Promise<TarotReading[]> {
  const { data, error } = await admin
    .from("tarot_sessions")
    .select("id, created_at, picks, classification, worry_skipped, paid_at")
    .eq("user_id", userId)
    .eq("result_status", "ready")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("tarot_sessions 조회 실패(타로 마이그레이션 전일 수 있음):", error.message);
    return [];
  }
  // 타로는 세 번째 카드(앞으로의 열쇠)를 결제 뒤에 공개한다(2026-11-02) — 결제 전 결과는 그 카드를 빼고 넘긴다.
  return (data as (TarotRow & { paid_at?: string | null })[])
    .map((r) => {
      const reading = toReading(r, TAROT_ORIGIN);
      return reading && !r.paid_at ? { ...reading, cards: reading.cards.filter((c) => c.position !== "step") } : reading;
    })
    .filter((r): r is TarotReading => r !== null);
}
