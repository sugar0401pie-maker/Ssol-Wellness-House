import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";

// 대화 목록에서 지난 대화 하나를 골랐을 때 그 안의 메시지를 불러온다.
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }

  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { sessionId } = await params;
  const admin = createAdminClient();

  // 이 세션이 정말 내 것인지 먼저 확인한다(다른 사람 세션ID를 넣어도 못 보게).
  const { data: session } = await admin
    .from("chat_sessions")
    .select("session_id")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "대화를 찾을 수 없습니다." }, { status: 404 });

  const { data: rows, error } = await admin
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "대화를 불러오지 못했습니다." }, { status: 500 });

  return NextResponse.json({
    sessionId,
    messages: (rows ?? []).map((r) => ({ role: r.role, content: r.content })),
  });
}

// 2026-10-01 owner 요청: "지난 대화" 목록에서 삭제. 실제로는 소프트 삭제 — deleted_at만
// 세우고 메시지·세션 행 자체는 그대로 둔다(데이터 보존). 목록 조회(GET /api/chat/sessions)가
// deleted_at is null인 것만 돌려주므로 목록에서만 사라진다.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }

  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { sessionId } = await params;
  const admin = createAdminClient();

  const { data: updated, error } = await admin
    .from("chat_sessions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .select("session_id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "삭제하지 못했어요." }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "대화를 찾을 수 없습니다." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
