import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { loadQuizReportsList } from "@/lib/mypage/loadQuizReportsList";

// 마이페이지 "내 유형 열람하기" 목록 전용 — 응시 기록별로 한 줄(응시일·유형·보고서 존재 여부)만
// 준다. 무거운 보고서 본문은 /api/mypage/reports/[resultId]에서 "열기"를 눌렀을 때만 가져온다.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const admin = createAdminClient();
  const reports = await loadQuizReportsList(admin, userId);
  return NextResponse.json({ reports });
}
