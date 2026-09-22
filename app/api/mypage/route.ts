import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { TYPE_KEY_TO_DESSERT } from "@/lib/mypage/dessertTypeMap";

// 마이페이지 전용: "내 유형", "결과보고서", "내 정보"를 한 번에 준다.
// 2026-09-22 결정: 로그인 계정을 기존 웰니스 유형 테스트/결제 사이트와 공유하므로,
// 그 사이트의 결과(ssol_quiz_results)·보고서(ssol_reports)를 "읽기 전용"으로만 조회한다.
// CLAUDE.md 규칙: ssol_* 테이블은 절대 쓰기/수정하지 않는다.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }

  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const admin = createAdminClient();

  const [{ data: authUser }, { data: profile }, { data: ssolProfile }, { data: quizResult }, { data: reports }] =
    await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
      admin.from("ssol_profiles").select("name, gender").eq("id", userId).maybeSingle(),
      admin
        .from("ssol_quiz_results")
        .select("type_key, domain_scores, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("ssol_reports")
        .select("sections, status, ready_at, created_at")
        .eq("user_id", userId)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  let persona: {
    label: string;
    tagline: string;
    blurb: string;
    traits: string[];
    domainScores: Record<string, number> | null;
  } | null = null;

  if (quizResult?.type_key) {
    const dessertCode = TYPE_KEY_TO_DESSERT[quizResult.type_key];
    if (dessertCode) {
      const { data: rich } = await admin
        .from("persona_profiles")
        .select("name, tagline, blurb, traits")
        .eq("code", dessertCode)
        .maybeSingle();
      if (rich) {
        persona = {
          label: rich.name,
          tagline: rich.tagline,
          blurb: rich.blurb,
          traits: rich.traits ?? [],
          domainScores: (quizResult.domain_scores as Record<string, number>) ?? null,
        };
      }
    }
  }

  return NextResponse.json({
    displayName: profile?.display_name ?? ssolProfile?.name ?? null,
    email: authUser?.user?.email ?? null,
    gender: ssolProfile?.gender ?? null,
    persona,
    report: reports?.sections?.length ? { sections: reports.sections as { title: string; body: string }[] } : null,
  });
}
