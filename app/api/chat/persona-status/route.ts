import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { loadQuizPersona } from "@/lib/mypage/loadQuizPersona";

// 채팅 첫 화면이 "성향 질문 칩"을 보여 줄지 정하려고 부르는 가벼운 조회(2026-10-22): 디저트 유형 테스트 결과가 있는지만 알려 준다.
// 결과가 없으면 화면은 일상 고민 시작 문구를 대신 보여 준다. 유형 내용은 싣지 않는다.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  try {
    const persona = await loadQuizPersona(createAdminClient(), userId, { includeReport: false });
    return NextResponse.json({ hasPersona: !!persona });
  } catch {
    return NextResponse.json({ hasPersona: false }); // 확인하지 못하면 일상 문구(테스트 없이도 답할 수 있는 쪽)로
  }
}
