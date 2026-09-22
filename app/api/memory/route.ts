import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { summarizeSessionIntoMemory } from "@/lib/memory/summarize";

// 사용자가 "이 대화를 기억하기"를 선택했을 때만 프런트에서 호출한다 (동의 기반).
// 선택하지 않은 대화는 이 엔드포인트가 아예 호출되지 않으므로 요약되지 않는다.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let body: { sessionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
  if (!sessionId) return NextResponse.json({ error: "sessionId가 필요합니다." }, { status: 400 });

  const result = await summarizeSessionIntoMemory(userId, sessionId);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 404 });
  return NextResponse.json({ ok: true });
}
