import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";

// 마이페이지 "대표 유형으로 선택" 전용 — 홈 화면/채팅이 어떤 응시 기록을 쓸지 고정한다.
// 2026-09-28 owner 요청: 여러 번 응시했을 때 항상 "가장 최근 결과"가 아니라 원하는 유형을
// 대표로 고를 수 있게 한다. profiles.primary_quiz_result_id에 저장하며, ssol_quiz_results는
// 다른 앱 소유라 FK 없이 느슨한 참조로만 저장한다(CLAUDE.md 규칙).
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let body: { resultId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const resultId = typeof body.resultId === "string" ? body.resultId : "";
  if (!resultId) return NextResponse.json({ error: "결과를 선택해주세요." }, { status: 400 });

  const admin = createAdminClient();

  // 이 응시 기록이 정말 이 사용자 것인지 먼저 확인한다(다른 사람 응시 id를 직접 넣는 것을 막는다).
  const { data: result, error: resultError } = await admin
    .from("ssol_quiz_results")
    .select("id, user_id")
    .eq("id", resultId)
    .maybeSingle();
  if (resultError) console.error("ssol_quiz_results 조회 실패:", resultError.message);
  if (!result || result.user_id !== userId) {
    return NextResponse.json({ error: "결과를 찾을 수 없어요." }, { status: 404 });
  }

  const { error } = await admin.from("profiles").update({ primary_quiz_result_id: resultId }).eq("user_id", userId);
  if (error) return NextResponse.json({ error: "대표 유형 지정에 실패했어요." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
