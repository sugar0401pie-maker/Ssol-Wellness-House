import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { TYPE_KEY_TO_DESSERT } from "./dessertTypeMap";

// 2026-09-27 owner 요청: "지금은 보고서가 1개인데 나중에 여러 개를 열람할 수도 있으니" —
// 마이페이지의 "내 유형 열람하기"를 여러 응시 기록을 보여주는 목록으로 바꾼다. 이 함수는 그
// 목록 한 줄씩(응시일 + 유형 이름 + 보고서 존재 여부)만 준다 — 무거운 보고서 본문은
// loadReportDetail()에서 "열기"를 눌렀을 때만 가져온다.
export type QuizReportListItem = {
  id: string; // ssol_quiz_results.id — 상세 페이지 주소(/report/[id])에 그대로 쓴다.
  createdAt: string;
  dessertCode: string;
  dessertName: string;
  hasReport: boolean;
  // 2026-09-28: 홈 화면/채팅이 지금 이 응시 기록을 쓰고 있는지 — owner가 명시적으로
  // "대표 유형으로 선택"했거나, 아무도 선택 안 해서 가장 최근 기록이 기본값으로 쓰이는 경우.
  isPrimary: boolean;
};

export async function loadQuizReportsList(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<QuizReportListItem[]> {
  const [{ data: results, error: resultsError }, { data: reports, error: reportsError }, { data: profile }] =
    await Promise.all([
      admin
        .from("ssol_quiz_results")
        .select("id, type_key, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      admin.from("ssol_reports").select("result_id").eq("user_id", userId).eq("status", "ready"),
      admin.from("profiles").select("primary_quiz_result_id").eq("user_id", userId).maybeSingle(),
    ]);
  if (resultsError) console.error("ssol_quiz_results 목록 조회 실패:", resultsError.message);
  if (reportsError) console.error("ssol_reports 목록 조회 실패:", reportsError.message);

  const reportedResultIds = new Set((reports ?? []).map((r) => r.result_id));

  // v1 시절 결과(예: "relate_F")처럼 새 매핑에 없는 type_key는 목록에서 뺀다 —
  // loadQuizPersona()가 이미 이런 값에 대해 "결과 없음"으로 처리하는 것과 같은 규칙이다.
  const mappable = (results ?? []).filter((r) => TYPE_KEY_TO_DESSERT[r.type_key]);
  if (mappable.length === 0) return [];

  const dessertCodes = [...new Set(mappable.map((r) => TYPE_KEY_TO_DESSERT[r.type_key]))];
  const { data: personas } = await admin.from("persona_profiles").select("code, name").in("code", dessertCodes);
  const nameByCode = new Map((personas ?? []).map((p) => [p.code, p.name]));

  // primary_quiz_result_id가 이 목록에 실제로 있는 id를 가리킬 때만 그걸 대표로 본다 —
  // 없거나 무효하면(탈퇴 등으로 사라진 값) 항상 최신 기록(mappable[0])이 대표다.
  const validPrimaryId = mappable.some((r) => r.id === profile?.primary_quiz_result_id)
    ? profile?.primary_quiz_result_id
    : null;
  const effectivePrimaryId = validPrimaryId ?? mappable[0].id;

  return mappable.map((r) => {
    const dessertCode = TYPE_KEY_TO_DESSERT[r.type_key];
    return {
      id: r.id,
      createdAt: r.created_at,
      dessertCode,
      dessertName: nameByCode.get(dessertCode) ?? dessertCode,
      hasReport: reportedResultIds.has(r.id),
      isPrimary: r.id === effectivePrimaryId,
    };
  });
}
