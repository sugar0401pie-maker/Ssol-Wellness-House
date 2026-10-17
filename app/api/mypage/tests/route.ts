import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { loadTestGroups } from "@/lib/mypage/testRegistry";

// 마이페이지 "테스트 결과 열람하기" 전용(2026-10-17): 등록된 모든 테스트 종류(디저트·점성술·앞으로 추가될 것들)의
// 내 결과 목록을 종류별 그룹으로 한 번에 준다. 어떤 종류를 보여줄지는 lib/mypage/testRegistry.ts에서만 정한다.
// 로그인한 본인 결과만 — user_id가 비어 있는 비로그인(게스트) 결과는 어느 계정에도 붙지 않으므로 나오지 않는다.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const groups = await loadTestGroups(createAdminClient(), userId);
  return NextResponse.json({ groups });
}
