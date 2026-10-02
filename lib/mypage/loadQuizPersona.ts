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
  // 채팅 개인화 참고 자료로 함께 준다. 결제 안 한 사용자는 report가 아예 없으니 null — 정상
  // 케이스, 에러 아님.
  // 2026-10-02 owner 요청: 예전엔 8개 섹션 중 section2·section8 두 개만 뽑아 썼는데(채팅에
  // "과한" 내용이라 판단), 유형 정보를 포함한 전체 내용을 전달하도록 범위를 넓혔다 — 아래
  // buildReportInsight() 참고. 동시에 prompt.ts 쪽 지침도 "리포트를 그대로 인용하면 안 된다"에서
  // "인용해도 된다"로 바뀌었다(이 둘은 같은 결정의 두 축이라 항상 같이 움직여야 한다).
  reportInsight: string | null;
};

// 2026-09-25 버그 발견: 심리테스트 앱이 v2로 재구축되면서 ssol_reports의 리포트 본문 컬럼이
// sections(배열, {title,body}[]) → assembled(객체, {section2..section7})로 바뀌었다(마스터
// 스펙 8.2/8.3). 예전 컬럼명으로 select하면 에러가 나는데, 에러를 버리고 data만 구조분해했던
// 탓에 조용히 reportInsight가 비어 있었다. 그중 실제 문장이 있는 두 섹션만 골라 쓴다 —
// section2(주목할 만한 부분은, 왜 이 영역이 낮은지)와 section8(바로 지금, 작은 변화를
// 만들어봐요 — 이번 주에 바로 해볼 수 있는 것 1개)이 대화에 가장 바로 쓸모 있다.
// 나머지(프로파일 모양/대처 상세/궁합/특수 플래그)는 채팅 참고용으로는 과해서 뺀다.
//
// 2026-09-30 재발견: 형제 사이트가 그 뒤로 또 한 번 리포트를 개편하면서(section1·8 추가,
// 8섹션 전부 항상 string[] — 문단 배열) 두 가지가 깨져 있었다. (1) "이번 주 제안"에
// 해당하는 실제 내용은 이제 section7(앞으로 나아갈 방향 — 여러 제안)이 아니라 section8
// (바로 지금, 작은 변화를 만들어봐요 — 이번 주에 할 구체적인 것 하나)에 있는데 계속
// section7을 읽고 있었다. (2) section7/section8도 이제 항상 배열인데 join(" ") 없이
// 템플릿 문자열에 바로 넣어서, 배열이 Array.prototype.toString()으로 강제 변환돼
// 문단 사이에 공백 없이 쉼표로 뭉쳐진 문장이 채팅 참고 자료로 들어가고 있었다.
// 2026-10-02: 채팅이 리포트를 "참고만" 하던 데서 "직접 인용 가능"으로 바뀌면서, 섹션별
// 300자 자르기는 의미가 없어졌다(인용하라고 해놓고 문장을 중간에 끊으면 모순). 대신 전체
// 길이에만 안전장치를 둔다 — 8섹션 전부 합쳐도 보통 리포트 한 편이 이 안에 들어온다.
const MAX_TOTAL_CHARS = 6000;

// 섹션 순서·라벨은 report_builder.py/reportV3의 제목과 맞춘다(둘 다 같은 8섹션 구조).
const SECTION_LABELS: Record<string, string> = {
  section1: "1. 당신의 웰니스 프로파일",
  section2: "2. 주목할 만한 부분은",
  section3: "3. 고민을 다루는 나의 방식",
  section4: "4. 한 겹 더 들여다보기",
  section5: "5. 이런 순간, 익숙하지 않나요?",
  section6: "6. 다른 유형과의 궁합",
  section7: "7. 앞으로 나아갈 방향",
  section8: "8. 이번 주 제안",
};
const SECTION_ORDER = Object.keys(SECTION_LABELS);

// 2026-09-30: 형제 사이트의 GeneratedSectionsV3에서 모든 섹션은 항상 문단 배열(string[])이다 —
// 예전(문자열 하나였던 시절) 흔적이 남아있을 가능성까지 함께 받아준다.
function sectionText(value: unknown): string | null {
  if (Array.isArray(value)) return value.length ? value.join(" ") : null;
  if (typeof value === "string" && value) return value;
  return null;
}

// 2026-10-02: 유형 정보(section1)를 포함해 8개 섹션 전부를 전달한다 — 결제한 사람의 리포트
// 전체를 채팅이 참고·인용할 수 있게 하자는 owner 결정. 비결제 사용자는 ssol_reports 조회
// 자체가 비어서(loadQuizPersona 참고) 이 함수에 애초에 null이 들어오고, 그대로 null을
// 반환한다 — 심층보고서 없는 사용자는 자연히 아무 영향도 받지 않는다.
function buildReportInsight(assembled: unknown): string | null {
  if (!assembled || typeof assembled !== "object") return null;
  const a = assembled as Record<string, unknown>;
  const picked: string[] = [];
  for (const key of SECTION_ORDER) {
    const text = sectionText(a[key]);
    if (text) picked.push(`[${SECTION_LABELS[key]}] ${text}`);
  }
  if (!picked.length) return null;
  const joined = picked.join("\n");
  return joined.length > MAX_TOTAL_CHARS ? joined.slice(0, MAX_TOTAL_CHARS) + "…" : joined;
}

// 2026-09-28: 마이페이지에서 "대표 유형으로 선택"한 응시 기록이 있으면 그걸 쓰고, 없으면
// 기존처럼 가장 최근 응시 기록을 쓴다. profiles.primary_quiz_result_id는 다른 앱 소유 테이블
// (ssol_quiz_results)에 대한 "느슨한 참조"일 뿐이라(CLAUDE.md 규칙상 FK를 걸지 않음), 여기서
// 매번 그 id가 실제로 이 사용자 소유인지 확인한다 — 탈퇴/재가입 등으로 무효해진 값이면
// 안전하게 최신 응시 기록으로 되돌아간다.
async function loadSelectedQuizResult(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{ id: string; type_key: string; axis_scores: unknown } | null> {
  const { data: profile } = await admin.from("profiles").select("primary_quiz_result_id").eq("user_id", userId).maybeSingle();
  const primaryId = profile?.primary_quiz_result_id;

  if (primaryId) {
    const { data: primaryResult, error: primaryError } = await admin
      .from("ssol_quiz_results")
      .select("id, type_key, axis_scores, user_id")
      .eq("id", primaryId)
      .maybeSingle();
    if (primaryError) console.error("대표 유형(primary_quiz_result_id) 조회 실패:", primaryError.message);
    if (primaryResult && primaryResult.user_id === userId) return primaryResult;
    // 값이 있는데 못 찾았거나 남의 것이면(드문 경우) 조용히 최신 결과로 대체한다 — 아래로 진행.
  }

  const { data: latest, error: latestError } = await admin
    .from("ssol_quiz_results")
    .select("id, type_key, axis_scores")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // 2026-09-25 버그 발견: 심리테스트 앱이 v2로 실제 재구축되면서 ssol_quiz_results의 점수
  // 컬럼명이 domain_scores -> axis_scores로 바뀌었다(v2 스펙의 CAR/LOV/REL/SLF/DIR 축 이름과
  // 통일). 예전 컬럼명으로 select하면 Postgres가 "column does not exist" 에러를 내는데,
  // 에러를 버리고 data만 구조분해했던 탓에 조용히 null로 넘어가 "테스트했는데 마이페이지에
  // 결과가 안 나온다"는 문제가 모든 사용자에게 나고 있었다 — 이제 에러도 로그로 남긴다.
  if (latestError) console.error("ssol_quiz_results 조회 실패:", latestError.message);
  return latest ?? null;
}

export async function loadQuizPersona(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<QuizPersona | null> {
  const quizResult = await loadSelectedQuizResult(admin, userId);
  if (!quizResult?.type_key) return null;

  const dessertCode = TYPE_KEY_TO_DESSERT[quizResult.type_key];
  if (!dessertCode) return null; // v1 시절 결과(예: "relate_F")처럼 새 매핑에 없는 값

  // 2026-09-28: reportInsight도 "이 사용자의 아무 최신 보고서"가 아니라, 지금 쓰고 있는 이
  // 응시 기록(quizResult.id)에 실제로 연결된 보고서만 가져온다 — ssol_reports.result_id가
  // ssol_quiz_results.id를 가리키는 실제 FK다(마이페이지 결과 목록/상세와 같은 방식).
  const [{ data: rich }, { data: report }] = await Promise.all([
    admin.from("persona_profiles").select("name, tagline, blurb, traits").eq("code", dessertCode).maybeSingle(),
    admin
      .from("ssol_reports")
      .select("assembled")
      .eq("result_id", quizResult.id)
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
    reportInsight: buildReportInsight(report?.assembled),
  };
}
