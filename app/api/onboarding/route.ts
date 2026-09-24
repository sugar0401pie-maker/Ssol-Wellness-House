import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import {
  ENJOYMENT_OPTIONS,
  ENJOYMENT_TO_CATEGORY,
  CONCERN_OPTIONS,
  CONCERN_TO_DOMAIN,
  type EnjoymentOption,
  type ConcernOption,
} from "@/lib/onboarding/mappings";

// 로그인 직후 "자기소개" 온보딩 — 홈 탭의 실천방법 제안을 개인화하는 데만 쓴다(SAFE-005와
// 같은 이유로 진단·안전 판단에는 안 씀). GET은 완료 여부+닉네임/호칭 기본값을 주고,
// POST는 답변을 저장한다.
export const runtime = "nodejs";

function titleFor(gender: string | null | undefined): string {
  if (gender === "female") return "공주";
  if (gender === "male") return "왕자";
  return "공작";
}

export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: profile }, { data: ssolProfile }, { data: quizResult }] = await Promise.all([
    admin.from("profiles").select("display_name, onboarding_completed_at").eq("user_id", userId).maybeSingle(),
    admin.from("ssol_profiles").select("name, gender").eq("id", userId).maybeSingle(),
    admin
      .from("ssol_quiz_results")
      .select("user_name, gender")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const nickname = profile?.display_name ?? ssolProfile?.name ?? quizResult?.user_name ?? null;
  const gender = ssolProfile?.gender ?? quizResult?.gender ?? null;

  return NextResponse.json({
    completed: !!profile?.onboarding_completed_at,
    nickname,
    title: titleFor(gender),
    enjoymentOptions: ENJOYMENT_OPTIONS,
    concernOptions: CONCERN_OPTIONS,
  });
}

export async function POST(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let body: { enjoyment?: unknown; concern?: unknown; concernOther?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const enjoyment = ENJOYMENT_OPTIONS.includes(body.enjoyment as EnjoymentOption)
    ? (body.enjoyment as EnjoymentOption)
    : null;
  const concern = CONCERN_OPTIONS.includes(body.concern as ConcernOption) ? (body.concern as ConcernOption) : null;
  if (!enjoyment || !concern) {
    return NextResponse.json({ error: "선택지 중에서 골라주세요." }, { status: 400 });
  }
  const concernOther = concern === "기타" && typeof body.concernOther === "string" ? body.concernOther.slice(0, 200) : null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      enjoyment_category: ENJOYMENT_TO_CATEGORY[enjoyment],
      concern_domain: CONCERN_TO_DOMAIN[concern],
      concern_other: concernOther,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: "저장에 실패했어요." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
