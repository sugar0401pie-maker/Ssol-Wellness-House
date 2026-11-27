import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { uiCopy } from "@/lib/engine";
import { getPending, getResult, isResultId, markPaid } from "@/lib/store";
import { kakaopayApprove } from "@/lib/kakaopay";
import { partnerUserOf } from "@/lib/order";

export const metadata = { robots: { index: false } };

// /checkout/{id}/success/{쪽}?pg_token=… — 카카오페이 결제창에서 결제가 끝나면 돌아오는 곳.
// 서버가 준비 때 적어 둔 거래 번호·주문 번호·금액으로 카카오페이 승인을 요청하고,
// 응답이 같은 주문·같은 사용자·같은 거래·같은 금액일 때만 결제 완료로 기록한 뒤 그 쪽을 연다.
// 이미 결제된 결과면 승인을 다시 부르지 않고 바로 연다(새로고침·뒤로 가기).
export default async function KakaoPaySuccess({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; page: string }>;
  searchParams: Promise<{ pg_token?: string }>;
}) {
  const { id, page: pageStr } = await params;
  const { pg_token } = await searchParams;
  const page = Math.min(14, Math.max(4, Number(pageStr) || 4));
  const r = isResultId(id) ? await getResult(id) : null;
  if (!r) notFound();
  if (r.paid) redirect(`/result/${id}/${page}?opened=1`);

  const ck = uiCopy().checkout;
  let failed = "결제 정보가 맞지 않아요.";
  const pending = await getPending(id);
  if (pending && typeof pg_token === "string" && /^[\w-]{1,100}$/.test(pg_token)) {
    const a = await kakaopayApprove({ tid: pending.tid, orderId: pending.orderId, userId: partnerUserOf(id), pgToken: pg_token, amount: pending.amount });
    if (a.ok) {
      await markPaid(id, { orderId: pending.orderId, paymentKey: a.aid, amount: a.total });
      redirect(`/result/${id}/${page}?opened=1`);
    }
    failed = a.error;
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
