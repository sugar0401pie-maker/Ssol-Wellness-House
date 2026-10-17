import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

// 쏠 점성술 하우스(astro.ssolwellnesshouse.com, 별도 저장소 ssol-astro-test) 결과 요약을 채팅 참고 자료로 불러온다.
// 2026-10-08 owner 결정: 유형 문장·2026년 회고·2027년에 바라는 것과 그 판정·앞으로 5년의 흐름, 결제했으면 리포트 본문과
// 제안까지("사실상 보고서"). 2026-10-10부터 태양·달·상승궁 별자리도 들어 있다. 출생 날짜/시간/장소는 그쪽에서 이미 빼고 만든다(astro_results.chat_summary,
// 형식은 디저트 심층 리포트와 같은 "[번호. 제목] 본문" 한 줄씩 → lib/rag/reportSelect.ts로 관련 섹션만 고른다).
// astro_results는 그 앱 소유 테이블이라 여기서는 읽기만 한다(ssol_* 규칙과 같은 원칙). 표·칸이 없거나(그쪽 마이그레이션 전)
// 조회가 실패하면 null — 채팅은 점성술 참고 없이 그대로 동작한다. 에러를 버리지 않고 남긴다(2026-09-25 교훈).
export async function loadAstroInsight(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("astro_results")
    .select("chat_summary, paid_at, created_at")
    .eq("user_id", userId)
    .not("chat_summary", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) {
    console.warn("점성술 결과 요약 조회 실패:", error.code);
    return null;
  }
  const rows = (data ?? []) as Array<{ chat_summary: string | null; paid_at: string | null }>;
  // 결제한 리포트가 있으면 그것(내용이 더 많음), 없으면 가장 최근 결과.
  const pick = rows.find((r) => r.paid_at) ?? rows[0];
  return pick?.chat_summary ?? null;
}
