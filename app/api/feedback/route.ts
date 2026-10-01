import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { sendEmail } from "@/lib/email/resend";
import { FEEDBACK_CATEGORIES } from "@/lib/feedback/categories";

// 2026-10-01: 마이페이지 "고객의 의견" 건의 접수. name/phone/email은 폼에서 따로 받지 않고
// (동의 문구에 이미 "성명과 연락처를 포함한 접수 내용을 수집"한다고 안내했으므로) 제출
// 시점의 profiles/auth.users 값을 그대로 스냅샷해서 저장한다.
export const runtime = "nodejs";

// 2026-10-01 owner 지정: 상담 예약 알림(COUNSELOR_NOTIFY_EMAIL)과 다른 수신자 — 고객 의견은
// contact@ssolwellness.com으로 보낸다.
const NOTIFY_EMAIL = process.env.FEEDBACK_NOTIFY_EMAIL ?? "contact@ssolwellness.com";
const CONTENT_MAX = 2000;

export async function POST(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let body: { category?: unknown; content?: unknown; agreed?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const category = typeof body.category === "string" ? body.category : "";
  const content = typeof body.content === "string" ? body.content.trim().slice(0, CONTENT_MAX) : "";
  const agreed = body.agreed === true;

  if (!FEEDBACK_CATEGORIES.some((c) => c.id === category)) {
    return NextResponse.json({ error: "분류를 선택해주세요." }, { status: 400 });
  }
  if (!content) return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
  if (!agreed) return NextResponse.json({ error: "개인정보 수집·이용에 동의해주세요." }, { status: 400 });

  const admin = createAdminClient();
  const [{ data: authUser }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("display_name, nickname, phone").eq("user_id", userId).maybeSingle(),
  ]);
  const name = profile?.nickname ?? profile?.display_name ?? null;
  const phone = profile?.phone ?? null;
  const email = authUser?.user?.email ?? null;

  const { data: inserted, error } = await admin
    .from("customer_feedback")
    .insert({
      user_id: userId,
      category,
      content,
      name,
      phone,
      email,
      consent_agreed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !inserted) return NextResponse.json({ error: "접수에 실패했어요." }, { status: 500 });

  const categoryLabel = FEEDBACK_CATEGORIES.find((c) => c.id === category)?.label ?? category;
  const sent = await sendEmail({
    to: NOTIFY_EMAIL,
    subject: `[쏠 웰니스] 고객의 의견 접수 - ${categoryLabel}`,
    text: [
      `마이페이지를 통해 새 의견이 접수됐어요.`,
      ``,
      `분류: ${categoryLabel}`,
      `이름: ${name ?? "-"}`,
      `연락처: ${phone ?? "-"}`,
      `이메일: ${email ?? "-"}`,
      ``,
      `내용:`,
      content,
    ].join("\n"),
  });
  if (sent.ok) {
    await admin.from("customer_feedback").update({ notified_at: new Date().toISOString() }).eq("id", inserted.id);
  } else {
    console.warn("고객 의견 접수 이메일 발송 실패:", sent.reason);
  }

  return NextResponse.json({ ok: true });
}
