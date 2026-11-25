import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { setUsageUser, withUsageScope } from "@/lib/ai/usage";
import { loadGreetingName } from "@/lib/profile/greetingName";
import { buildTestOpening } from "@/lib/persona/testOpening";
import { testOpeningSourceFrom } from "@/lib/persona/testOpeningSource";

// 테스트를 하고 들어온 사람의 첫 메시지(2026-11-25 대표님). GET ?from=tarot|astro|quiz&result=… → { text } (만들지 못하면 text: null — 화면은 고정 인사).
// 본인 결과만 읽는다(각 loader가 user_id로 거른다). 같은 결과로 다시 들어오면 화면이 이 기기에 저장해 둔 글을 다시 쓴다(매번 새로 만들지 않음).
export const runtime = "nodejs";

async function handleGET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  setUsageUser(userId);
  const src = testOpeningSourceFrom(req.nextUrl.search);
  if (!src) return NextResponse.json({ text: null });
  try {
    const admin = createAdminClient();
    const name = await loadGreetingName(admin, userId).catch(() => null);
    return NextResponse.json({ text: await buildTestOpening(admin, userId, src, name) });
  } catch (e) {
    console.error("테스트 첫 메시지 만들기 실패:", e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return NextResponse.json({ text: null });
  }
}

export async function GET(req: NextRequest) {
  return withUsageScope("chat_test_opening", () => handleGET(req));
}
