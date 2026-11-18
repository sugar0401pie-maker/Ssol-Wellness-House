import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { kakaopayConfig } from "@/lib/billing/kakaopay";

export const runtime = "nodejs";

// 결제 화면이 어떤 방식으로 결제할지 묻는다. 카카오페이를 쓰려면 두 가지가 모두 준비돼야 한다:
//  ① 서버에 카카오페이 키(KAKAOPAY_SECRET_KEY·KAKAOPAY_CID) ② DB에 카카오페이 칸(마이그레이션 20261118000000).
// 하나라도 없으면 기존 토스 결제(주문서)로 자동으로 돌아간다 — 키를 먼저 넣고 마이그레이션을 잊어도 결제가 막히지 않게.
// 키 값 자체는 알려 주지 않고 "쓸 수 있다/없다"만 준다.
export async function GET() {
  let kakaopay = kakaopayConfig() !== null;
  if (kakaopay) {
    const { error } = await createAdminClient().from("chat_entitlements").select("payment_provider,kakaopay_tid,kakaopay_aid").limit(1);
    if (error) {
      console.error("[billing/methods] 카카오페이 칸 없음 — 토스로 대신함:", error.message);
      kakaopay = false;
    }
  }
  return NextResponse.json({ kakaopay }, { headers: { "Cache-Control": "no-store" } });
}
