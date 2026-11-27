import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { uiCopy, priceNow } from "@/lib/engine";
import { getResult, isResultId, markPaid } from "@/lib/store";
import { confirmPayment } from "@/lib/toss";
import { resultIdOfOrder } from "@/lib/order";

export const metadata = { robots: { index: false } };

// /checkout/{id}/success?paymentKey=…&orderId=…&amount=…&page=쪽 — 토스 결제창이 돌려보내는 곳.
// 서버가 ① 주문 번호가 이 결과의 것인지 ② 금액이 지금 가격과 같은지 확인하고 ③ 토스 승인 API가 DONE을 줄 때만 결제 완료로 기록한다.
// 승인 실패면 결과를 열지 않고 다시 결제하기로 안내한다. 이미 결제된 결과면 승인을 다시 부르지 않고 바로 연다.
export default async function CheckoutSuccess({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paymentKey?: string; orderId?: string; amount?: string; page?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const page = Math.min(14, Math.max(4, Number(sp.page) || 4));
  const r = isResultId(id) ? await getResult(id) : null;
  if (!r) notFound();
  if (r.paid) redirect(`/result/${id}/${page}?opened=1`);

  const ck = uiCopy().checkout;
  const amount = Number(sp.amount);
  let failed = "결제 정보가 맞지 않아요.";
  if (sp.paymentKey && sp.orderId && resultIdOfOrder(sp.orderId) === id && amount === priceNow().price) {
    const c = await confirmPayment(sp.paymentKey, sp.orderId, amount);
    if (c.ok) {
      await markPaid(id, { orderId: c.orderId, paymentKey: c.paymentKey, amount: c.amount });
      redirect(`/result/${id}/${page}?opened=1`);
    }
    failed = c.message;
  }
  return (
    <div className="pg">
      <h2>{ck.fail}</h2>
      <p className="sub">{failed}</p>
      <Link className="btn" href={`/checkout/${id}?page=${page}`} style={{ textAlign: "center", textDecoration: "none" }}>
        {ck.fail_button}
      </Link>
    </div>
  );
}
