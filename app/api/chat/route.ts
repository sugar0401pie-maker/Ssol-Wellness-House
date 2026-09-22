import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { determineRoute } from "@/lib/safety/route";
import { getSafetyData } from "@/lib/safety/rules";
import { FIXED_RESPONSES, SHORT_HELP_CONTACT } from "@/lib/safety/crisisResponses";
import { generateAnswer } from "@/lib/rag/generate";
import { DAILY_MESSAGE_LIMIT, startOfTodayKST } from "@/lib/safety/dailyLimit";
import { checkAccessCode } from "@/lib/security/accessCode";
import type { RouteId } from "@/lib/safety/types";

// C5: 안전 라우팅 + 위기/폭력 고정 응답(C4) + route 3~7의 실제 검색·답변 생성 + 하루 사용량 제한.
// 위기(route 1)·폭력(route 2)은 아래에서 이 제한 검사보다 먼저 처리되어, 제한과 무관하게 항상 응답한다.
export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 2000;

function safetyFlagFor(route: RouteId): "crisis" | "elevated" | "none" {
  if (route === "crisis") return "crisis";
  if (route === "violence" || route === "clinical_diagnosis" || route === "clinical_distress") return "elevated";
  return "none";
}
const FLAG_RANK = { none: 0, elevated: 1, crisis: 2 } as const;

export async function POST(req: NextRequest) {
  // ACCESS_CODE가 설정된 경우에만 검사한다(로컬 개발 시엔 비활성). DB·OpenAI 호출보다 먼저,
  // 가장 가벼운 검사부터 한다.
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }

  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { message?: unknown; sessionId?: unknown; isPersonaQuestion?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const isPersonaQuestion = body.isPersonaQuestion === true;
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
  if (!sessionId) return NextResponse.json({ error: "대화를 시작할 수 없습니다." }, { status: 500 }); // TS 안전망(도달 안 함)

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
    const reply = `지금 답변을 만드는 데 문제가 생겼어요. 잠시 후 다시 시도해주세요. ${SHORT_HELP_CONTACT}`;
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

  // route 3~7만 하루 사용량 제한을 적용한다 (crisis·violence·classifierUnavailable은 이미 위에서 반환됨).
  // 방금 저장한 이번 메시지도 포함해서 세어, count가 제한을 넘으면 이번 메시지는 생성 없이 막는다.
  const { count: todayCount } = await admin
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user")
    .not("route", "in", "(crisis,violence)")
    .gte("created_at", startOfTodayKST().toISOString());

  if ((todayCount ?? 0) > DAILY_MESSAGE_LIMIT) {
    const reply = `오늘 나눌 수 있는 대화 횟수를 모두 사용했어요. 내일 다시 이야기해요. ${SHORT_HELP_CONTACT}`;
    await admin
      .from("chat_messages")
      .insert({ session_id: sessionId, user_id: userId, role: "assistant", content: reply, route: decision.route });
    return NextResponse.json({
      sessionId,
      route: decision.route,
      reply,
      done: true,
      limitReached: true,
      remainingToday: 0,
      ...routingMeta,
    });
  }

  // route 3~7: 실제 검색 → 프롬프트 조립 → 생성 → 출력 검사.
  const { rules: safetyRules } = await getSafetyData();
  const result = await generateAnswer({
    route: decision.route,
    matchedRuleIds: decision.matchedRuleIds,
    message,
    recentMessages,
    safetyRules,
    userId,
    sessionId,
    isPersonaQuestion,
  });

  await admin.from("chat_messages").insert({
    session_id: sessionId,
    user_id: userId,
    role: "assistant",
    content: result.reply,
    route: decision.route,
    retrieved_chunk_ids: result.retrievedChunkIds.length ? result.retrievedChunkIds : null,
    framework_id: result.frameworkId,
  });

  const usageTotals = result.usage.reduce(
    (acc, u) => ({ inputTokens: acc.inputTokens + u.inputTokens, outputTokens: acc.outputTokens + u.outputTokens }),
    { inputTokens: 0, outputTokens: 0 },
  );

  return NextResponse.json({
    sessionId,
    route: decision.route,
    reply: result.reply,
    done: true,
    remainingToday: Math.max(DAILY_MESSAGE_LIMIT - (todayCount ?? 0), 0),
    ...routingMeta,
    // 사용량 정보(민감정보 아님) — 비용 시뮬레이션(scripts/cost-simulation.mjs)이 이 값을 읽는다.
    usage: {
      classifierInputTokens: decision.classifierUsage?.inputTokens ?? 0,
      classifierOutputTokens: decision.classifierUsage?.outputTokens ?? 0,
      generationInputTokens: usageTotals.inputTokens,
      generationOutputTokens: usageTotals.outputTokens,
      regenerated: result.regenerated,
    },
  });
}
