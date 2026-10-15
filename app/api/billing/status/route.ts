import { NextRequest, NextResponse } from "next/server";
import { getUserIdFast } from "@/lib/supabase/auth";
import { createTimer } from "@/lib/perf/serverTiming";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { loadAccessStatus } from "@/lib/billing/loadAccess";

// 채팅 화면이 마운트될 때 미리 확인해서, 메시지를 보내보기 전에 무료체험 종료 안내를
// 보여줄 수 있게 한다. 실제 차단은 app/api/chat/route.ts에서 서버가 한 번 더 확인한다
// (여기서는 화면 안내용일 뿐 — 이 값만 믿고 클라이언트가 우회할 수 없다).
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  // 2026-10-16: 화면 안내용 읽기 전용 GET이라 토큰을 공개키로 직접 검증하는 빠른 확인을 쓴다(실제 차단은 chat API가 엄격하게 한다).
  const timer = createTimer();
  const userId = await getUserIdFast(req.headers.get("authorization"));
  timer.mark("auth");
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const admin = createAdminClient();
  const access = await timer.time("db", loadAccessStatus(admin, userId));
  return NextResponse.json(access, { headers: { "Server-Timing": timer.header() } });
}
