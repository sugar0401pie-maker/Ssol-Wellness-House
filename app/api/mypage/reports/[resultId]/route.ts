import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { loadReportDetail } from "@/lib/mypage/loadReportDetail";

// /report/[resultId] 페이지 전용 — 특정 응시 기록 하나의 전체 심층보고서(모든 섹션)를 준다.
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ resultId: string }> }) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { resultId } = await params;
  const admin = createAdminClient();
  const detail = await loadReportDetail(admin, userId, resultId);
  if (!detail) return NextResponse.json({ error: "결과를 찾을 수 없어요." }, { status: 404 });

  return NextResponse.json(detail);
}
