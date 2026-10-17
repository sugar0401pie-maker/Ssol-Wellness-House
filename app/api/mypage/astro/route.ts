import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { loadAstroResultsList } from "@/lib/mypage/loadAstroResultsList";

// 마이페이지 "내 점성술 결과" 목록 전용(2026-10-17). 로그인한 본인의 결과만 준다 — user_id가 비어 있는
// 비로그인(게스트) 결과는 어느 계정에도 붙지 않으므로 여기에 나오지 않는다.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const results = await loadAstroResultsList(createAdminClient(), userId);
  return NextResponse.json({ results });
}
