import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";

// 마이페이지 "내 정보 확인"에서 닉네임(표시 이름)을 바꿀 때 쓴다. 2026-09-24: 온보딩
// 팝업에서는 닉네임을 못 바꾸게 하고("테스트할 때 입력한 걸 기본값으로만 보여줌"), 여기서만
// 바꾸도록 한 결정에 맞춘 엔드포인트.
export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let body: { displayName?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 50) : "";
  if (!displayName) return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ display_name: displayName }).eq("user_id", userId);
  if (error) return NextResponse.json({ error: "저장에 실패했어요." }, { status: 500 });

  return NextResponse.json({ ok: true, displayName });
}
