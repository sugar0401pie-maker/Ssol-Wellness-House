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
};

export async function loadQuizPersona(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<QuizPersona | null> {
  const { data: quizResult } = await admin
    .from("ssol_quiz_results")
    .select("type_key, domain_scores")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!quizResult?.type_key) return null;

  const dessertCode = TYPE_KEY_TO_DESSERT[quizResult.type_key];
  if (!dessertCode) return null; // v1 시절 결과(예: "relate_F")처럼 새 매핑에 없는 값

  const { data: rich } = await admin
    .from("persona_profiles")
    .select("name, tagline, blurb, traits")
    .eq("code", dessertCode)
    .maybeSingle();
  if (!rich) return null;

  const axisCode = quizResult.type_key.split("-")[0];
  return {
    dessertCode,
    axisCode,
    name: rich.name,
    tagline: rich.tagline,
    blurb: rich.blurb,
    traits: rich.traits ?? [],
    domainScores: (quizResult.domain_scores as Record<string, number>) ?? null,
  };
}
