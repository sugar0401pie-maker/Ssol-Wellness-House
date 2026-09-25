import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { TYPE_KEY_TO_DESSERT } from "./dessertTypeMap";

// ssol_quiz_results(심리테스트 v2, 다른 앱 소유 — 읽기 전용) + persona_profiles(우리 테이블,
// 15유형 설명)를 조합해서 로그인 사용자의 웰니스 유형을 가져온다.
//
// 2026-09-24 발견/통합: 예전엔 채팅의 페르소나 힌트(lib/rag/generate.ts)가 wellness_profiles
// (우리 테이블, dessert_type 컬럼)를 봤는데, 이 테이블은 실제 퀴즈 결과와 연결하는 코드가
// 없어서 실사용자 기준으로는 채워진 적이 없었다(내 테스트 스크립트로만 값을 넣었을 뿐).
// 마이페이지(app/api/mypage/route.ts)는 처음부터 ssol_quiz_results를 직접 읽고 있었으므로,
// 그 로직을 여기로 뽑아내 채팅 쪽도 같은 방식(ssol_quiz_results 직접 조회)을 쓰도록 통일한다.
// wellness_profiles는 이제 이 조회 경로에서 쓰지 않는다(과거 계획의 흔적으로 테이블 자체는
// 남겨둠 — 필요해지면 다른 용도로 재사용 가능).
export type QuizPersona = {
  dessertCode: string; // persona_profiles.code (예: "brownie")
  axisCode: string; // ssol_quiz_results.type_key의 영역 부분 (예: "CAR")
  name: string;
  tagline: string;
  blurb: string;
  traits: string[];
  domainScores: Record<string, number> | null;
  // 2026-09-25: 유료 심층 리포트(ssol_reports, 결정론적 조립 — AI 자유생성 아님)가 있으면
  // 그중 "주 고민 영역 해부"/"이번 주 제안" 두 섹션만 채팅 개인화 참고 자료로 함께 준다.
  // 결제 안 한 사용자는 report가 아예 없으니 null — 정상 케이스, 에러 아님.
  reportInsight: string | null;
};

// ssol_reports.sections는 7섹션({title, body}) 배열이다(마스터 스펙 8.2). 그중 실제 문장이
// 있는 두 섹션만 골라 쓴다 — "주 고민 영역 해부"(왜 이 영역이 낮은지)와 "이번 주 제안"(바로
// 해볼 수 있는 것 1개)이 대화에 가장 바로 쓸모 있다. 나머지(오각형/프로파일 모양/대처 상세/
// 궁합/특수 플래그)는 채팅 참고용으로는 과해서 뺀다. 제목이 바뀌면 매칭이 안 될 뿐 에러는
// 안 나므로(그냥 reportInsight가 비게 됨) 안전하다.
const RELEVANT_SECTION_TITLES = ["주 고민 영역 해부", "이번 주 제안"];
const MAX_SECTION_CHARS = 300;

function buildReportInsight(sections: unknown): string | null {
  if (!Array.isArray(sections)) return null;
  const picked = sections
    .filter(
      (s): s is { title: string; body: string } =>
        !!s && typeof s === "object" && RELEVANT_SECTION_TITLES.includes((s as { title?: string }).title ?? ""),
    )
    .map((s) => `${s.title}: ${s.body.length > MAX_SECTION_CHARS ? s.body.slice(0, MAX_SECTION_CHARS) + "…" : s.body}`);
  return picked.length ? picked.join("\n") : null;
}

export async function loadQuizPersona(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<QuizPersona | null> {
  // 2026-09-25 버그 발견: 심리테스트 앱이 v2로 실제 재구축되면서 ssol_quiz_results의 점수
  // 컬럼명이 domain_scores -> axis_scores로 바뀌었다(v2 스펙의 CAR/LOV/REL/SLF/DIR 축 이름과
  // 통일). 예전 컬럼명으로 select하면 Postgres가 "column does not exist" 에러를 내는데,
  // 에러를 버리고 data만 구조분해했던 탓에 조용히 null로 넘어가 "테스트했는데 마이페이지에
  // 결과가 안 나온다"는 문제가 모든 사용자에게 나고 있었다 — 이제 에러도 로그로 남긴다.
  const { data: quizResult, error: quizError } = await admin
    .from("ssol_quiz_results")
    .select("type_key, axis_scores")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (quizError) console.error("ssol_quiz_results 조회 실패:", quizError.message);
  if (!quizResult?.type_key) return null;

  const dessertCode = TYPE_KEY_TO_DESSERT[quizResult.type_key];
  if (!dessertCode) return null; // v1 시절 결과(예: "relate_F")처럼 새 매핑에 없는 값

  const [{ data: rich }, { data: report }] = await Promise.all([
    admin.from("persona_profiles").select("name, tagline, blurb, traits").eq("code", dessertCode).maybeSingle(),
    admin
      .from("ssol_reports")
      .select("sections")
      .eq("user_id", userId)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!rich) return null;

  const axisCode = quizResult.type_key.split("-")[0];
  return {
    dessertCode,
    axisCode,
    name: rich.name,
    tagline: rich.tagline,
    blurb: rich.blurb,
    traits: rich.traits ?? [],
    domainScores: (quizResult.axis_scores as Record<string, number>) ?? null,
    reportInsight: buildReportInsight(report?.sections),
  };
}
