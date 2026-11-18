import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { PLAN_LABELS, currentPrice, isPlanId } from "@/lib/billing/pricing";
import { kakaopayConfig, kakaopayReady } from "@/lib/billing/kakaopay";

// 2026-11-18: 이용권 버튼 → (주문서 없이) 카카오페이 결제창(토스 대신 — 토스 결제 흐름은 제거됨). 먼저 우리 DB에 pending 주문을 만들고,
// 카카오페이에 결제 준비를 요청해 받은 거래 번호(tid)를 그 행에 저장한 뒤, 브라우저가 열 카카오페이 주소를 돌려준다.
// 실제 이용권은 approve 단계에서 카카오페이 서버 승인과 금액 확인이 끝나야만 열린다.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!kakaopayConfig()) return NextResponse.json({ error: "카카오페이 결제가 아직 설정되지 않았어요." }, { status: 503 });

  let body: { plan?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const planId = body.plan;
  if (!isPlanId(planId)) return NextResponse.json({ error: "이용권 종류를 선택해주세요." }, { status: 400 });
  const amount = currentPrice(planId);
  if (amount === null) return NextResponse.json({ error: "지금은 선택할 수 없는 이용권이에요." }, { status: 400 });

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .from("chat_entitlements")
    .insert({ user_id: userId, plan: planId, status: "pending", amount, payment_provider: "kakaopay" })
    .select("id")
    .single();
  if (error || !inserted) {
    console.error("[kakaopay/ready] 주문 생성 실패:", error?.message); // 마이그레이션(20261118000000) 전이면 payment_provider 칸이 없어 여기서 멈춘다
    return NextResponse.json({ error: "결제를 준비하지 못했어요." }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  const ready = await kakaopayReady({ orderId: inserted.id, userId, itemName: `쏘웰라 ${PLAN_LABELS[planId]}`, amount, origin });
  if (!ready.ok) {
    await admin.from("chat_entitlements").update({ status: "canceled", note: `카카오페이 준비 실패: ${ready.error}`.slice(0, 300), updated_at: new Date().toISOString() }).eq("id", inserted.id);
    console.error("[kakaopay/ready] 준비 실패:", ready.error);
    return NextResponse.json({ error: "카카오페이 결제창을 열지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 502 });
  }
  const { error: saveErr } = await admin.from("chat_entitlements").update({ kakaopay_tid: ready.result.tid, updated_at: new Date().toISOString() }).eq("id", inserted.id);
  if (saveErr) {
    console.error("[kakaopay/ready] 거래 번호 저장 실패:", saveErr.message);
    return NextResponse.json({ error: "결제를 준비하지 못했어요." }, { status: 500 });
  }
  return NextResponse.json({ orderId: inserted.id, pcUrl: ready.result.pcUrl, mobileUrl: ready.result.mobileUrl });
}
