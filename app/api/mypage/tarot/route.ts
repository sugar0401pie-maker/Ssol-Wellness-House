import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { loadTarotReadings } from "@/lib/tarot/loadTarotReadings";
import { TAROT_ORIGIN } from "@/lib/tarot/catalog";

// 마이페이지 "타로 결과": 이 계정에 저장된 쏠 타로 결과 목록(카드·위치·방향·고민 분류 이름). 읽기 전용.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const readings = await loadTarotReadings(createAdminClient(), userId);
  return NextResponse.json({ readings, tarotUrl: TAROT_ORIGIN }, { headers: { "Cache-Control": "no-store" } });
}
