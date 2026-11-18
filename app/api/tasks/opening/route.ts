import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { cardsOnFor } from "@/lib/cards/offer";
import { taskOpening } from "@/lib/tasks/server";

// 새 대화 첫머리: 지난번에 고른 작은 연습이 있으면 "해 보니 어땠어요?" 카드(2026-11-18 3부-3, 엔진 openingFor).
// 읽기 전용이라 AI 호출·사용량 제한이 없다. 없거나 꺼져 있으면 { opening: null } — 화면은 평소 첫 인사만 보여 준다.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const admin = createAdminClient();
  try {
    if (!(await cardsOnFor(admin, userId))) return NextResponse.json({ opening: null });
    return NextResponse.json({ opening: await taskOpening(admin, userId) });
  } catch {
    return NextResponse.json({ opening: null });
  }
}
