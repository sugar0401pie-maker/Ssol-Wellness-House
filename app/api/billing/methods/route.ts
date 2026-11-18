import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { kakaopayConfig } from "@/lib/billing/kakaopay";

export const runtime = "nodejs";

// 결제 화면이 어떤 방식으로 결제할지 묻는다. 카카오페이를 쓰려면 두 가지가 모두 준비돼야 한다:
//  ① 서버에 카카오페이 키(KAKAOPAY_SECRET_KEY·KAKAOPAY_CID) ② DB에 카카오페이 칸(마이그레이션 20261118000000).
// 하나라도 없으면 결제 버튼을 막고 "결제 준비 중"을 보인다(2026-11-18부터 토스는 쓰지 않는다 — 대신할 결제 수단 없음).
// 키 값 자체는 알려 주지 않고 "쓸 수 있다/없다"만 준다.
export async function GET() {
  let kakaopay = kakaopayConfig() !== null;
  if (kakaopay) {
    const { error } = await createAdminClient().from("chat_entitlements").select("payment_provider,kakaopay_tid,kakaopay_aid").limit(1);
    if (error) {
      console.error("[billing/methods] 카카오페이 칸 없음 — 결제 준비 중으로 표시:", error.message);
      kakaopay = false;
    }
  }
  return NextResponse.json({ kakaopay }, { headers: { "Cache-Control": "no-store" } });
}
