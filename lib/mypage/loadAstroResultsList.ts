import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

// 2026-10-17 owner 요청: 마이페이지에 "내 점성술 결과" 목록. 목록에는 결과가 있다는 사실(날짜·이름·리포트 여부)만 보이고,
// 세부 내용은 점성술 앱의 결과 페이지로 연결한다(lib/mypage/astroResultUrl.ts). 별자리·출생 정보는 목록에 싣지 않는다.
// astro_results는 점성술 앱 소유 테이블이라 여기서는 읽기만 하고, 조회가 실패해도 마이페이지 전체를 막지 않도록
// 빈 목록을 돌려준다(에러는 버리지 않고 남긴다 — 2026-09-25 교훈).
export type AstroResultListItem = {
  id: string;
  createdAt: string;
  nickname: string | null;
  // 결제해서 심층 리포트가 열린 결과인지(점성술 앱의 paid_at).
  paid: boolean;
  lastPage: number | null;
};

const MAX_ITEMS = 30;

export async function loadAstroResultsList(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<AstroResultListItem[]> {
  const { data, error } = await admin
    .from("astro_results")
    .select("id, created_at, nickname, paid_at, last_page")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_ITEMS);
  if (error) {
    console.error("astro_results 목록 조회 실패:", error.code, error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    createdAt: r.created_at as string,
    nickname: (r.nickname as string | null) ?? null,
    paid: Boolean(r.paid_at),
    lastPage: typeof r.last_page === "number" ? r.last_page : null,
  }));
}
