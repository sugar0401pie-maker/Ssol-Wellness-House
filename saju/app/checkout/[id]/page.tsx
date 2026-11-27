import { notFound, redirect } from "next/navigation";
import { uiCopy, fill, priceNow } from "@/lib/engine";
import { getResult, isResultId } from "@/lib/store";
import { randomBytes } from "node:crypto";
import { fakePaymentEnabled } from "@/lib/payment";
import { tossEnabled } from "@/lib/toss";
import { makeOrderId, customerKeyOf } from "@/lib/order";
import { testName } from "@/lib/tests";
import CheckoutForm from "@/components/common/CheckoutForm";

export const metadata = { robots: { index: false } };

// /checkout/{결과 번호}?page=쪽 — 상품·가격 상자 → 동의 한 줄 → 결제. 끝나면 그 쪽으로 돌아가 ?opened=1.
// 토스 키(NEXT_PUBLIC_TOSS_CLIENT_KEY, TOSS_SECRET_KEY)가 있으면 토스 결제창, 없으면 로컬에서만 개발용 가짜 결제.
export default async function Checkout({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const page = Math.min(14, Math.max(4, Number(sp.page) || 4));
  const r = isResultId(id) ? await getResult(id) : null;
  if (!r) notFound();
  if (r.paid) redirect(`/result/${id}/${page}?opened=1`);
  const c = uiCopy();
  const ck = c.checkout;
  const p = priceNow();
  const mode = tossEnabled() ? "toss" : fakePaymentEnabled() ? "fake" : "off";
  const vars = { title: c.tests[testName(r.slug)].title, price: p.priceText, list: p.listText, badge: p.badge ?? "" };
  return (
    <div className="pg">
      <div className="box">
        <h3 style={{ marginTop: 0 }}>{fill(ck.product, vars)}</h3>
        <p className="sub">{ck.product_sub}</p>
        <p style={{ fontSize: 20, margin: "8px 0 0" }}>
          {p.onSale && <s className="sub" style={{ fontSize: 14, marginRight: 8 }}>{p.listText}</s>}
          {p.badge && <span className="badge strong" style={{ marginRight: 8 }}>{p.badge}</span>}
          <b>{p.priceText}</b>
        </p>
      </div>
      <CheckoutForm
        id={id}
        page={page}
        mode={mode}
        toss={
          mode === "toss"
            ? {
                clientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "",
                customerKey: customerKeyOf(id),
                orderId: makeOrderId(id, randomBytes(6).toString("base64url")),
                orderName: fill(ck.product, vars),
                amount: p.price,
              }
            : null
        }
        copy={{ consent: ck.consent, consent_note: ck.consent_note, button: fill(ck.button, vars), fail: ck.fail, success_wait: ck.success_wait }}
      />
    </div>
  );
}
