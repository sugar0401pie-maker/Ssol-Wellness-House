import { NextResponse } from "next/server";
import { markPaid, isResultId } from "@/lib/store";
import { fakePaymentEnabled } from "@/lib/payment";

// 개발용 가짜 결제. 실제 결제(토스)는 연결할 때 이 자리를 토스 결제 승인 확인으로 바꾼다 —
// 결제 완료는 반드시 서버가 토스에 승인 결과를 확인한 뒤에만 paid로 바꿔야 한다(브라우저 말만 믿지 않음).
// 운영에서는 SAJU_FAKE_PAYMENT=1을 켜지 않는 한 막혀 있다.

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!fakePaymentEnabled()) return NextResponse.json({ error: "결제 연결 전이에요." }, { status: 403 });
  const { id } = await ctx.params;
  if (!isResultId(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const r = await markPaid(id);
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
