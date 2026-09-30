import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { DOMAIN_LABELS } from "@/lib/wellness/domainLabels";
import { assembledToSections, type AssembledReportV3, type ReportSectionData } from "./assembledReport";
import { TYPE_KEY_TO_DESSERT } from "./dessertTypeMap";

export type ReportDetail = {
  createdAt: string;
  persona: {
    dessertCode: string;
    name: string;
    tagline: string;
    blurb: string;
    traits: string[];
    domainScores: Record<string, number> | null;
  };
  report: { sections: ReportSectionData[] } | null;
};

// /report/[resultId] 상세 페이지 전용 — 특정 응시 기록 하나(resultId = ssol_quiz_results.id)의
// 전체 심층보고서(모든 섹션)를 가져온다. loadQuizPersona()(홈 탭·채팅 개인화용, "최신 결과만")와
// 달리, 목록에서 고른 임의의 과거 결과 하나를 정확히 가리켜야 해서 별도 함수로 둔다.
//
// 본인 소유 확인: resultId로 조회한 행의 user_id가 요청자와 다르면(다른 사용자의 결과 주소를
// 직접 입력해 접근하는 경우) null을 돌려주고, 호출부(API 라우트)가 404로 처리한다.
export async function loadReportDetail(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  resultId: string,
): Promise<ReportDetail | null> {
  const { data: result, error: resultError } = await admin
    .from("ssol_quiz_results")
    .select("id, user_id, type_key, axis_scores, created_at")
    .eq("id", resultId)
    .maybeSingle();
  if (resultError) console.error("ssol_quiz_results 상세 조회 실패:", resultError.message);
  if (!result || result.user_id !== userId) return null;

  const dessertCode = TYPE_KEY_TO_DESSERT[result.type_key];
  if (!dessertCode) return null; // v1 시절 결과 — 목록에서도 이미 걸러지므로 정상 경로로는 도달하지 않음

  // "CAR-primary" -> "CAR" -> "커리어"(3·5번 섹션 제목에 들어감, quiz 앱의 확정 영역 이름과 같은 자리).
  const confirmedAxisKey = result.type_key.split("-")[0];
  const axisKR = DOMAIN_LABELS[confirmedAxisKey] ?? "고민";

  const [{ data: rich, error: richError }, { data: reportRow, error: reportError }] = await Promise.all([
    admin.from("persona_profiles").select("name, tagline, blurb, traits").eq("code", dessertCode).maybeSingle(),
    admin
      .from("ssol_reports")
      .select("assembled")
      .eq("result_id", resultId)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (richError) console.error("persona_profiles 조회 실패:", richError.message);
  if (reportError) console.error("ssol_reports(resultId) 조회 실패:", reportError.message);
  if (!rich) return null;

  const sections = assembledToSections(reportRow?.assembled as AssembledReportV3 | undefined, axisKR);
  return {
    createdAt: result.created_at,
    persona: {
      dessertCode,
      name: rich.name,
      tagline: rich.tagline,
      blurb: rich.blurb,
      traits: rich.traits ?? [],
      domainScores: (result.axis_scores as Record<string, number>) ?? null,
    },
    report: sections.length ? { sections } : null,
  };
}
