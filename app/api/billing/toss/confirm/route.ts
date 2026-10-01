import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { sendEmail } from "@/lib/email/resend";
import { confirmTossPayment, computeExpiryFor } from "@/lib/billing/toss";
import { PLAN_LABELS } from "@/lib/billing/pricing";

// 2026-09-27: 토스 결제창에서 결제가 끝나면 브라우저가 successUrl로 돌아오면서
// paymentKey/orderId/amount를 넘겨준다. 이걸 그대로 믿지 않고, 여기서 시크릿 키로
// 토스 서버에 "진짜 승인됐는지" 한 번 더 확인(confirm)한 뒤에만 이용권을 활성화한다.
// orderId는 app/api/billing/checkout에서 만든 chat_entitlements 행의 id 그대로다.
export const runtime = "nodejs";

const NOTIFY_EMAIL = process.env.COUNSELOR_NOTIFY_EMAIL ?? "junseok@ssolwellness.com";

export async function POST(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let body: { paymentKey?: unknown; orderId?: unknown; amount?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const paymentKey = typeof body.paymentKey === "string" ? body.paymentKey : "";
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  if (!paymentKey || !orderId || !Number.isFinite(amount)) {
    return NextResponse.json({ error: "결제 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const admin = createAdminClient();

  // 이 주문이 정말 "이 로그인한 사용자"의 것이고, 아직 처리 전(pending)인지 먼저 확인한다.
  // 남의 주문을 도용하거나, 이미 승인 처리된 주문을 다시 승인 요청하는 것을 막는다.
  const { data: entitlement, error: fetchError } = await admin
    .from("chat_entitlements")
    .select("id, user_id, plan, amount, status")
    .eq("id", orderId)
    .maybeSingle();
  if (fetchError) console.error("chat_entitlements 조회 실패:", fetchError.message);
  if (!entitlement || entitlement.user_id !== userId) {
    return NextResponse.json({ error: "주문 정보를 찾을 수 없어요." }, { status: 404 });
  }
  if (entitlement.status !== "pending") {
    return NextResponse.json({ error: "이미 처리된 주문이에요." }, { status: 409 });
  }
  if (entitlement.amount !== amount) {
    return NextResponse.json({ error: "결제 금액이 일치하지 않아요." }, { status: 400 });
  }

  const result = await confirmTossPayment({ paymentKey, orderId, amount });
  if (!result.ok) {
    await admin.from("chat_entitlements").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("id", orderId);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const now = new Date();
  const plan = entitlement.plan as "monthly" | "annual";
  const expiresAt = computeExpiryFor(plan, now);
  await admin
    .from("chat_entitlements")
    .update({
      status: "active",
      starts_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      toss_order_id: orderId,
      toss_payment_key: paymentKey,
      updated_at: now.toISOString(),
    })
    .eq("id", orderId);

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const sent = await sendEmail({
    to: NOTIFY_EMAIL,
    subject: `[쏠 웰니스] 이용권 결제 완료 - ${PLAN_LABELS[plan]}`,
    text: [
      `이용권 결제가 실제로 완료됐어요 (토스페이먼츠 자동 확인됨).`,
      ``,
      `이용권: ${PLAN_LABELS[plan]} (${amount.toLocaleString()}원)`,
      `이메일: ${authUser?.user?.email ?? "-"}`,
      `만료일: ${expiresAt.toISOString().slice(0, 10)}`,
    ].join("\n"),
  });
  if (!sent.ok) console.warn("결제 완료 알림 이메일 발송 실패:", sent.reason);

  return NextResponse.json({ ok: true, expiresAt: expiresAt.toISOString(), plan });
}
