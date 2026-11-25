import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { summarizeSessionIntoMemory } from "@/lib/memory/summarize";
import { checkAccessCode } from "@/lib/security/accessCode";
import { withUsageScope } from "@/lib/ai/usage";

// 2026-11-24 대표님 결정: 묻지 않고, 사용자가 새 대화를 시작할 때 화면이 지금 대화를 자동으로 보낸다(예전에는 "기억하기"를 고른 경우만).
// 근거는 약관 제17조 2항(2026-11-25 시행 — 대화 내용을 이전 대화 이어가기·맞춤 제안에 이용). 위기·폭력 메시지는 요약에서 빠진다(lib/memory/summarize.ts).
export const runtime = "nodejs";

async function handlePOST(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }

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

// AI 사용량 기록(ai_usage_log)에 이 요청의 기능 이름·사용자를 붙이려고 요청 전체를 사용량 범위로 감싼다(lib/ai/usage.ts).
export function POST(req: NextRequest) {
  return withUsageScope("memory", () => handlePOST(req));
}
