import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 쏠 타로 하우스(tarot.ssolwellnesshouse.com, 별도 저장소 ssol-tarot) 결과 요약을 채팅 참고 자료로 불러온다.
// 2026-10-26 owner 결정: 고민 원문과 결과 화면의 글(결제 전이면 무료 부분만)을 쏘웰라에 넘긴다 — 타로 앱이 tarot_sessions.chat_summary에
// "[고민 원문] …", "[결과 정보] …", "[번호. 제목] 본문" 줄로 써 두고(최대 6,000자), 여기서는 읽기만 한다(점성술 loadAstroInsight와 같은 방식).
// resultId(타로 10쪽 버튼으로 넘어온 결과)가 이 사용자 것이면 그 결과, 아니면 가장 최근 결과. 칸·표가 없거나 실패하면 null(채팅은 그대로 동작).
export async function loadTarotInsight(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  resultId?: string | null,
): Promise<string | null> {
  const base = () => admin.from("tarot_sessions").select("chat_summary").eq("user_id", userId).not("chat_summary", "is", null);
  if (resultId && UUID.test(resultId)) {
    const { data, error } = await base().eq("id", resultId).maybeSingle();
    if (error) console.warn("타로 결과 요약 조회 실패:", error.code);
    else if (data?.chat_summary) return data.chat_summary as string;
  }
  const { data, error } = await base().order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    console.warn("타로 결과 요약 조회 실패(타로 마이그레이션 전일 수 있음):", error.code);
    return null;
  }
  return (data?.chat_summary as string | undefined) ?? null;
}

// 쏘웰라 첫 인사용(타로에서 넘어온 경우): 그 결과의 고민 글과 세 번째 카드. 본인 결과가 아니면 null.
export async function loadTarotWelcome(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  resultId: string,
): Promise<{ worry: string | null; picks: unknown; nickname: string | null } | null> {
  if (!UUID.test(resultId)) return null;
  const { data, error } = await admin.from("tarot_sessions").select("worry_text, picks, nickname").eq("id", resultId).eq("user_id", userId).maybeSingle();
  if (error || !data) return null;
  return { worry: (data.worry_text as string | null) ?? null, picks: data.picks, nickname: (data.nickname as string | null) ?? null };
}
