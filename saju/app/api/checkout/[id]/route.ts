import { NextResponse } from "next/server";
import { markPaid, isResultId } from "@/lib/store";
import { fakePaymentEnabled } from "@/lib/payment";

// 개발용 가짜 결제(로컬 전용). 실제 결제는 카카오페이(/api/kakaopay/ready → /checkout/{id}/success/{쪽})가 한다 —
// 실제 결제 완료는 서버가 카카오페이 승인 결과를 확인한 뒤에만 paid로 바꾼다(브라우저 말만 믿지 않음).
// 운영에서는 SAJU_FAKE_PAYMENT=1을 켜지 않는 한 막혀 있다.

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!fakePaymentEnabled()) return NextResponse.json({ error: "결제 연결 전이에요." }, { status: 403 });
  const { id } = await ctx.params;
  if (!isResultId(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const r = await markPaid(id);
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
