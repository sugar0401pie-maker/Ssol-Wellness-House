import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { uiCopy, fill, priceNow } from "@/lib/engine";
import { getResult, isResultId, setPending } from "@/lib/store";
import { kakaopayConfig, kakaopayReady } from "@/lib/kakaopay";
import { isMobileUserAgent } from "@/lib/kakaopayRequest";
import { makeOrderId, partnerUserOf } from "@/lib/order";
import { testName } from "@/lib/tests";

// 결제 상자 [결제하기] → 카카오페이 결제 준비. 금액은 서버가 정한다(pricing.json — 화면이 보낸 값을 믿지 않음).
// 받은 거래 번호(tid)·주문 번호·금액을 결과에 적어 두고, 브라우저가 열 카카오페이 주소를 돌려준다.
// 실제로 결과가 열리는 것은 /checkout/{id}/success/{쪽}에서 카카오페이 승인과 금액 확인이 끝난 뒤뿐이다.
export async function POST(req: Request) {
  if (!kakaopayConfig()) return NextResponse.json({ error: "카카오페이 결제가 아직 설정되지 않았어요." }, { status: 503 });
  let body: { id?: unknown; page?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const id = typeof body.id === "string" && isResultId(body.id) ? body.id : null;
  const page = Math.min(14, Math.max(4, Number(body.page) || 4));
  const r = id ? await getResult(id) : null;
  if (!id || !r) return NextResponse.json({ error: "결과를 찾지 못했어요." }, { status: 404 });
  if (r.paid) return NextResponse.json({ next: `/result/${id}/${page}?opened=1` });

  const amount = priceNow().price;
  const orderId = makeOrderId(id, randomBytes(6).toString("base64url"));
  const c = uiCopy();
  const ready = await kakaopayReady({
    resultId: id,
    orderId,
    userId: partnerUserOf(id),
    itemName: fill(c.checkout.product, { title: c.tests[testName(r.slug)].title }).slice(0, 100),
    amount,
    page,
    origin: new URL(req.url).origin,
  });
  if (!ready.ok) {
    console.error("[kakaopay/ready] 준비 실패:", ready.error); // 키·고민·생년월일은 찍지 않는다
    return NextResponse.json({ error: "카카오페이 결제창을 열지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
  await setPending(id, { orderId, tid: ready.result.tid, amount });
  const mobile = isMobileUserAgent(req.headers.get("user-agent") ?? "");
  return NextResponse.json({ redirect: mobile ? ready.result.mobileUrl : ready.result.pcUrl });
}
