import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { sendEmail } from "@/lib/email/resend";
import { kakaopayApprove } from "@/lib/billing/kakaopay";
import { computeExpiryFor } from "@/lib/billing/expiry";
import { PLAN_LABELS, isPlanId } from "@/lib/billing/pricing";

// 2026-11-18: 카카오페이 결제창에서 결제가 끝나면 /pricing/kakaopay/<주문번호>?pg_token=... 으로 돌아오고, 그 화면이 이 API를 부른다.
// 브라우저가 넘긴 값만 믿지 않고: ① 이 로그인 사용자의 카카오페이 pending 주문인지 ② 카카오페이 서버 승인 ③ 승인 응답의 주문·사용자·거래·금액이
// 우리 주문과 같은지까지 확인한 뒤에만 이용권을 연다.
export const runtime = "nodejs";

const NOTIFY_EMAIL = process.env.COUNSELOR_NOTIFY_EMAIL ?? "junseok@ssolwellness.com";

export async function POST(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let body: { orderId?: unknown; pgToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const pgToken = typeof body.pgToken === "string" ? body.pgToken : "";
  if (!orderId || !pgToken) return NextResponse.json({ error: "결제 정보가 올바르지 않습니다." }, { status: 400 });

  const admin = createAdminClient();
  const { data: ent, error: fetchError } = await admin
    .from("chat_entitlements")
    .select("id, user_id, plan, amount, status, payment_provider, kakaopay_tid, expires_at")
    .eq("id", orderId)
    .maybeSingle();
  if (fetchError) console.error("[kakaopay/approve] 주문 조회 실패:", fetchError.message);
  if (!ent || ent.user_id !== userId || ent.payment_provider !== "kakaopay") return NextResponse.json({ error: "주문 정보를 찾을 수 없어요." }, { status: 404 });
  const plan = ent.plan;
  if (!isPlanId(plan)) return NextResponse.json({ error: "결제할 수 없는 이용권 종류예요." }, { status: 400 });
  // 새로고침 등으로 같은 주문을 다시 확인하면, 이미 승인된 주문은 그대로 성공으로 알려 준다(두 번 승인하지 않는다).
  if (ent.status === "active") return NextResponse.json({ ok: true, plan, expiresAt: ent.expires_at, already: true, orderId, amount: ent.amount ?? null });
  if (ent.status !== "pending" || !ent.kakaopay_tid) return NextResponse.json({ error: "이미 처리된 주문이에요." }, { status: 409 });

  const result = await kakaopayApprove({ tid: ent.kakaopay_tid, orderId, userId, pgToken, amount: ent.amount });
  if (!result.ok) {
    await admin.from("chat_entitlements").update({ status: "canceled", note: `카카오페이 승인 실패: ${result.error}`.slice(0, 300), updated_at: new Date().toISOString() }).eq("id", orderId);
    console.error("[kakaopay/approve] 승인 실패:", result.error);
    return NextResponse.json({ error: "결제 승인을 완료하지 못했어요. 결제가 빠져나갔다면 고객센터로 알려주세요." }, { status: 502 });
  }

  const now = new Date();
  const expiresAt = computeExpiryFor(plan, now);
  await admin
    .from("chat_entitlements")
    .update({ status: "active", starts_at: now.toISOString(), expires_at: expiresAt.toISOString(), kakaopay_aid: result.aid, updated_at: now.toISOString() })
    .eq("id", orderId);

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const sent = await sendEmail({
    to: NOTIFY_EMAIL,
    subject: `[쏠 웰니스] 이용권 결제 완료 - ${PLAN_LABELS[plan]} (카카오페이)`,
    text: [`이용권 결제가 실제로 완료됐어요 (카카오페이 자동 확인됨).`, ``, `이용권: ${PLAN_LABELS[plan]} (${result.total.toLocaleString()}원)`, `이메일: ${authUser?.user?.email ?? "-"}`, `만료일: ${expiresAt.toISOString().slice(0, 10)}`].join("\n"),
  });
  if (!sent.ok) console.warn("결제 완료 알림 이메일 발송 실패:", sent.reason);

  // orderId·amount(2026-11-24): 결제 완료 화면이 구글 광고 전환(실제 결제 금액·주문 번호)을 한 번 보낸다.
  return NextResponse.json({ ok: true, expiresAt: expiresAt.toISOString(), plan, orderId, amount: result.total });
}
