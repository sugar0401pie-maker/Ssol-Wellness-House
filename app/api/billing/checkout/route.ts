import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { PLAN_LABELS, currentPrice, type PlanId } from "@/lib/billing/pricing";

// 2026-09-27: 토스페이먼츠 결제창을 열기 전, "이 결제가 어떤 신청 건인지"를 먼저 우리
// DB에 status='pending'으로 남겨 orderId(=이 행의 id)를 만든다. 실제 승인은
// app/api/billing/toss/confirm에서 결제 완료 후 한 번 더 서버 대 서버로 확인한다 —
// 클라이언트가 "결제 성공했다"고 우기는 것만으로는 이용권을 열어주지 않는다.
export const runtime = "nodejs";

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

  // 2026-10-01: 프로모션 기간이면 할인가, 아니면 정가 — 체크아웃 시점에 한 번 계산해서
  // chat_entitlements.amount에 고정해둔다(결제 중간에 자정을 넘겨 프로모션이 끝나도 이미
  // 생성된 주문 금액은 안 바뀐다 — 토스 결제창에도 이미 그 금액으로 떴을 것이기 때문).
  const amount = currentPrice(planId);

  const { data: inserted, error } = await admin
    .from("chat_entitlements")
    .insert({ user_id: userId, plan: planId, status: "pending", amount })
    .select("id")
    .single();
  if (error || !inserted) return NextResponse.json({ error: "신청 접수에 실패했어요." }, { status: 500 });

  return NextResponse.json({
    orderId: inserted.id,
    orderName: PLAN_LABELS[planId],
    amount,
    customerKey: userId,
    customerName: profile?.nickname ?? profile?.display_name ?? "고객",
    customerEmail: authUser?.user?.email ?? undefined,
  });
}
