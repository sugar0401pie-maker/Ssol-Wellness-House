import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";

// 2026-09-24: 상담사 연결은 아직 외부 페이지로 바로 열어두지 않고, 신청만 받아서
// counselor_inquiries에 저장해둔다(owner가 수동으로 연락).
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let body: { contact?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const contact = typeof body.contact === "string" ? body.contact.trim().slice(0, 200) : "";
  if (!contact) return NextResponse.json({ error: "연락받을 이메일 또는 전화번호를 입력해주세요." }, { status: 400 });
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : null;

  const admin = createAdminClient();
  const { error } = await admin.from("counselor_inquiries").insert({ user_id: userId, contact, message });
  if (error) return NextResponse.json({ error: "신청 접수에 실패했어요." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
