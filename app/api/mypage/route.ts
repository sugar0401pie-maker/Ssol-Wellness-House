import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { loadQuizPersona } from "@/lib/mypage/loadQuizPersona";

// 마이페이지 전용: "내 유형", "결과보고서", "내 정보"를 한 번에 준다.
// 2026-09-22 결정: 로그인 계정을 기존 웰니스 유형 테스트/결제 사이트와 공유하므로,
// 그 사이트의 결과(ssol_quiz_results)·보고서(ssol_reports)를 "읽기 전용"으로만 조회한다.
// CLAUDE.md 규칙: ssol_* 테이블은 절대 쓰기/수정하지 않는다.
export const runtime = "nodejs";

// 2026-09-25 버그 발견: 심리테스트 앱이 v2로 재구축되면서 ssol_reports의 리포트 본문 컬럼이
// sections(배열, {title,body}[]) → assembled(객체, {section2..section7})로 바뀌었다. 예전
// 컬럼명으로 select하면 "column does not exist" 에러가 나는데, 에러를 버리고 data만
// 구조분해했던 탓에 조용히 report가 null로 넘어가고 있었다. assembled를 우리 프론트(
// components/app/MyPageTab.tsx)가 이미 알고 있는 {title,body}[] 모양으로 변환해서, 프론트
// 컴포넌트는 손대지 않고 여기서만 맞춘다.
type AssembledReportV2 = {
  section2: string | string[]; // 2026-09-25: 문단 구분을 위해 string[]로 바뀜(assembledToSections가 이미 배열을 처리함)
  section3: string | null;
  section4: string | string[];
  section5: string | null;
  section6: string[];
  section7: string | null;
};
const SECTION_TITLES: Record<keyof AssembledReportV2, string> = {
  section2: "주 고민 영역 해부",
  section3: "프로파일 모양",
  section4: "대처 상세",
  section5: "고민과 대처의 궁합",
  section6: "특수 플래그",
  section7: "이번 주 제안",
};
function assembledToSections(a: AssembledReportV2 | null | undefined): { title: string; body: string }[] {
  if (!a) return [];
  const out: { title: string; body: string }[] = [];
  (Object.keys(SECTION_TITLES) as (keyof AssembledReportV2)[]).forEach((key) => {
    const value = a[key];
    const body = Array.isArray(value) ? value.join(" ") : value;
    if (body) out.push({ title: SECTION_TITLES[key], body });
  });
  return out;
}

export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }

  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const admin = createAdminClient();

  const [{ data: authUser }, { data: profile }, { data: ssolProfile }, quizPersona, { data: reports }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin
      .from("profiles")
      .select("display_name, nickname, birth_date, phone, address, marketing_consent")
      .eq("user_id", userId)
      .maybeSingle(),
    admin.from("ssol_profiles").select("name, gender").eq("id", userId).maybeSingle(),
    loadQuizPersona(admin, userId),
    admin
      .from("ssol_reports")
      .select("assembled, status, ready_at, created_at")
      .eq("user_id", userId)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const persona = quizPersona
    ? {
        label: quizPersona.name,
        tagline: quizPersona.tagline,
        blurb: quizPersona.blurb,
        traits: quizPersona.traits,
        domainScores: quizPersona.domainScores,
      }
    : null;

  return NextResponse.json({
    displayName: profile?.display_name ?? ssolProfile?.name ?? null,
    nickname: profile?.nickname ?? null,
    birthDate: profile?.birth_date ?? null,
    phone: profile?.phone ?? null,
    address: profile?.address ?? null,
    marketingConsent: profile?.marketing_consent ?? false,
    email: authUser?.user?.email ?? null,
    gender: ssolProfile?.gender ?? null,
    persona,
    report: (() => {
      const sections = assembledToSections(reports?.assembled as AssembledReportV2 | undefined);
      return sections.length ? { sections } : null;
    })(),
  });
}
