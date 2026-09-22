import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { determineRoute } from "@/lib/safety/route";
import { FIXED_RESPONSES } from "@/lib/safety/crisisResponses";
import type { RouteId } from "@/lib/safety/types";

// C4 단계의 임시 버전: 안전 라우팅 + 위기/폭력 고정 응답까지만 동작한다.
// route 3~7(진단·인생결정·일상웰니스 등)의 실제 검색·AI 답변 생성은 C5에서 이 파일에 이어붙인다.
// 사용량 제한(하루 N회, 월 상한)은 아직 넣지 않았다 — C5에서 함께 넣을 예정.
export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 2000;

function safetyFlagFor(route: RouteId): "crisis" | "elevated" | "none" {
  if (route === "crisis") return "crisis";
  if (route === "violence" || route === "clinical_diagnosis" || route === "clinical_distress") return "elevated";
  return "none";
}
const FLAG_RANK = { none: 0, elevated: 1, crisis: 2 } as const;

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { message?: unknown; sessionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "메시지를 입력해주세요." }, { status: 400 });
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `메시지가 너무 길어요 (최대 ${MAX_MESSAGE_LENGTH}자).` }, { status: 400 });
  }

  const admin = createAdminClient();

  // 세션 확보: 넘어온 sessionId가 "내 것"이 맞는지 확인하고, 아니면 새로 만든다.
  let sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
  if (sessionId) {
    const { data } = await admin
      .from("chat_sessions")
      .select("session_id")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) sessionId = null; // 남의 세션이거나 존재하지 않음 → 새로 만든다
  }
  if (!sessionId) {
    const { data, error } = await admin.from("chat_sessions").insert({ user_id: userId }).select("session_id").single();
    if (error || !data) return NextResponse.json({ error: "대화를 시작할 수 없습니다." }, { status: 500 });
    sessionId = data.session_id;
  }

  // 최근 대화(최대 10개)를 분류기 문맥으로 사용
  const { data: recentRows } = await admin
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(10);
  const recentMessages = (recentRows ?? []).reverse() as { role: "user" | "assistant"; content: string }[];

  const decision = await determineRoute(message, recentMessages);
  // 라우팅 메타데이터(route/confidence/source)는 민감정보가 아니라 응답에 그대로 포함한다.
  // 안전 평가 스크립트(scripts/safety-eval.mjs)가 이 값으로 실제 판정 품질을 확인한다.
  const routingMeta = {
    confidence: decision.confidence,
    source: decision.source,
    classifierUnavailable: decision.classifierUnavailable,
  };

  // 사용자 메시지는 판정 결과(route)와 함께 항상 저장한다.
  await admin.from("chat_messages").insert({
    session_id: sessionId,
    user_id: userId,
    role: "user",
    content: message,
    route: decision.route,
  });

  // 세션 안전 상태는 올라가기만 한다 (CLAUDE.md: 세션 중 자동으로 낮추지 않는다).
  const newFlag = safetyFlagFor(decision.route);
  const { data: session } = await admin
    .from("chat_sessions")
    .select("safety_flag")
    .eq("session_id", sessionId)
    .single();
  const currentRank = session ? FLAG_RANK[session.safety_flag as keyof typeof FLAG_RANK] : 0;
  await admin
    .from("chat_sessions")
    .update({
      last_message_at: new Date().toISOString(),
      ...(FLAG_RANK[newFlag] > currentRank ? { safety_flag: newFlag } : {}),
    })
    .eq("session_id", sessionId);

  // 분류기를 아예 부르지 못한 경우: 내용을 지어내지 않고 안전한 안내만 준다.
  if (decision.classifierUnavailable) {
    const reply =
      "지금 일시적인 문제로 답변을 만들 수 없어요. 잠시 후 다시 시도해주세요. 급한 마음이 드신다면 화면 아래의 도움 연락처를 이용해주세요.";
    await admin
      .from("chat_messages")
      .insert({ session_id: sessionId, user_id: userId, role: "assistant", content: reply, route: decision.route });
    return NextResponse.json({ sessionId, route: decision.route, reply, done: true, ...routingMeta });
  }

  const fixed = FIXED_RESPONSES[decision.route];
  if (fixed) {
    await admin
      .from("chat_messages")
      .insert({ session_id: sessionId, user_id: userId, role: "assistant", content: fixed, route: decision.route });
    return NextResponse.json({ sessionId, route: decision.route, reply: fixed, done: true, ...routingMeta });
  }

  // route 3~7: 검색·답변 생성은 다음 단계(C5)에서 연결된다. 지금은 판정 결과만 돌려준다.
  return NextResponse.json({
    sessionId,
    route: decision.route,
    reply: null,
    done: false,
    note: "안전 판정 완료. 답변 생성은 다음 단계(C5)에서 연결됩니다.",
    ...routingMeta,
  });
}
