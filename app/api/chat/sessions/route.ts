import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";

// AI 채팅 탭의 "지난 대화" 목록. 읽기 전용 조회라 AI 호출도, 하루 대화 횟수 제한도 없다.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }

  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("chat_sessions")
    .select("session_id, topic_tag, started_at, last_message_at, safety_flag")
    .eq("user_id", userId)
    // topic_tag는 첫 메시지가 저장된 직후에만 채워진다 — null이면 메시지가 아직 없는(또는
    // 만들어지자마자 끊긴) 빈 세션이라 목록에서 뺀다.
    .not("topic_tag", "is", null)
    .order("last_message_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: "대화 목록을 불러오지 못했습니다." }, { status: 500 });

  const sessions = (data ?? []).map((s) => ({
    sessionId: s.session_id,
    topicTag: s.topic_tag,
    startedAt: s.started_at,
    lastMessageAt: s.last_message_at,
    safetyFlag: s.safety_flag,
  }));

  return NextResponse.json({ sessions });
}
