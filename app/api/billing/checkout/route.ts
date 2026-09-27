import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { sendEmail } from "@/lib/email/resend";
import { PLAN_LABELS, PLAN_PRICES, type PlanId } from "@/lib/billing/pricing";

// 2026-09-27: 토스페이먼츠 연동 전까지는 실제 결제를 처리하지 않는다. 신청을
// chat_entitlements에 status='pending'으로 남기고 관리자에게 이메일로 알린 뒤, owner가
// 결제(계좌이체 등)를 직접 확인하고 Supabase 테이블 편집기에서 status를 'active'로
// 바꿔주는 수동 절차를 쓴다 — 상담 예약 신청(app/api/counselor-inquiry)과 같은 패턴.
export const runtime = "nodejs";

const NOTIFY_EMAIL = process.env.COUNSELOR_NOTIFY_EMAIL ?? "junseok@ssolwellness.com";

export async function POST(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let body: { plan?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const plan = body.plan;
  if (plan !== "monthly" && plan !== "annual") {
    return NextResponse.json({ error: "이용권 종류를 선택해주세요." }, { status: 400 });
  }
  const planId = plan as PlanId;

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const { data: profile } = await admin.from("profiles").select("display_name, nickname").eq("user_id", userId).maybeSingle();

  const { data: inserted, error } = await admin
    .from("chat_entitlements")
    .insert({ user_id: userId, plan: planId, status: "pending", amount: PLAN_PRICES[planId] })
    .select("id")
    .single();
  if (error || !inserted) return NextResponse.json({ error: "신청 접수에 실패했어요." }, { status: 500 });

  const name = profile?.nickname ?? profile?.display_name ?? "이름 미상";
  const emailBody = [
    `새 이용권 결제 신청이 접수됐어요. (토스페이먼츠 연동 전 — 결제 확인 후 아래 신청 건을 'active'로 처리해주세요)`,
    ``,
    `이용권: ${PLAN_LABELS[planId]} (${PLAN_PRICES[planId].toLocaleString()}원)`,
    `이름: ${name}`,
    `이메일: ${authUser?.user?.email ?? "-"}`,
    `신청 ID: ${inserted.id}`,
  ].join("\n");
  const sent = await sendEmail({ to: NOTIFY_EMAIL, subject: `[쏠 웰니스] 이용권 결제 신청 - ${PLAN_LABELS[planId]}`, text: emailBody });
  if (!sent.ok) console.warn("이용권 신청 이메일 발송 실패:", sent.reason);

  return NextResponse.json({ ok: true });
}
