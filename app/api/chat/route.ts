import { NextRequest, NextResponse, after } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { determineRoute } from "@/lib/safety/route";
import { findKeywordHits, instantHit } from "@/lib/safety/keywordCheck";
import { embedQuery } from "@/lib/rag/retrieve";
import { getSafetyData } from "@/lib/safety/rules";
import { FIXED_RESPONSES, SHORT_HELP_CONTACT } from "@/lib/safety/crisisResponses";
import { generateAnswer } from "@/lib/rag/generate";
import { planHypothesis } from "@/lib/interp/hypothesis";
import { runInterpretation } from "@/lib/interp/run";
import { DAILY_MESSAGE_LIMIT, startOfTodayKST } from "@/lib/safety/dailyLimit";
import { HISTORY_MESSAGE_LIMIT, SESSION_LIMIT_REPLY, sessionLimitState } from "@/lib/chat/sessionLimit";
import { checkAccessCode } from "@/lib/security/accessCode";
import type { RouteId } from "@/lib/safety/types";
import { makeTopicTag } from "@/lib/chat/topicTag";
import { loadAccessStatus } from "@/lib/billing/loadAccess";
import { planDialogue } from "@/lib/theory/orchestrate";
import { isChoiceId } from "@/lib/theory/dialogueState";
import { createTimer, type Timer } from "@/lib/perf/serverTiming";

// C5: 안전 라우팅 + 위기/폭력 고정 응답(C4) + route 3~7의 실제 검색·답변 생성 + 하루 사용량 제한.
// 위기(route 1)·폭력(route 2)은 아래에서 이 제한 검사보다 먼저 처리되어, 제한과 무관하게 항상 응답한다.
export const runtime = "nodejs";
// 2026-10-18: 답변을 보낸 뒤 뒤에서 도는 발화 해석(after)이 끊기지 않도록 시간을 넉넉히 준다(60초는 모든 요금제에서 허용). 해석은 처음 한 번 임베딩 색인을 만드는 데 약 10초가 든다.
export const maxDuration = 60;

const MAX_MESSAGE_LENGTH = 2000;

function safetyFlagFor(route: RouteId): "crisis" | "elevated" | "none" {
  if (route === "crisis") return "crisis";
  if (route === "violence" || route === "clinical_diagnosis" || route === "clinical_distress") return "elevated";
  return "none";
}
const FLAG_RANK = { none: 0, elevated: 1, crisis: 2 } as const;

// 2026-10-16: 채팅 응답이 7~12초 걸려서 어느 단계가 오래 걸리는지 숫자로 보려고 단계별 시간을 Server-Timing 헤더에 싣는다
// (단계 이름과 ms만 들어 있고 대화 내용은 없다). 응답 방식·내용은 그대로다.
export async function POST(req: NextRequest) {
  const timer = createTimer();
  const res = await handle(req, timer);
  res.headers.set("Server-Timing", timer.header());
  return res;
}

async function handle(req: NextRequest, timer: Timer): Promise<NextResponse> {
  // ACCESS_CODE가 설정된 경우에만 검사한다(로컬 개발 시엔 비활성). DB·OpenAI 호출보다 먼저,
  // 가장 가벼운 검사부터 한다.
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }

  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  timer.lap("auth");
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { message?: unknown; sessionId?: unknown; isPersonaQuestion?: unknown; choiceId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const isPersonaQuestion = body.isPersonaQuestion === true;
  // "행동 제안받기 / 내 고민 더 알아보기" 칩(THEORY_OFFER_ENABLED가 켜졌을 때만 의미가 있다).
  const choiceId = isChoiceId(body.choiceId) ? body.choiceId : null;
  if (!message) return NextResponse.json({ error: "메시지를 입력해주세요." }, { status: 400 });
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `메시지가 너무 길어요 (최대 ${MAX_MESSAGE_LENGTH}자).` }, { status: 400 });
  }

  const admin = createAdminClient();

  // 세션 확보: 넘어온 sessionId가 "내 것"이 맞는지 확인하고, 아니면 새로 만든다.
  let sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
  // 2026-10-16(채팅 속도 개선): 세션 소유 확인과 최근 대화 조회는 서로 필요하지 않아 동시에 한다. 남의 세션이면 그 대화는 쓰지 않고 버린다.
  let recentMessages: { role: "user" | "assistant"; content: string }[] = [];
  if (sessionId) {
    const [{ data }, { data: rows }] = await Promise.all([
      admin.from("chat_sessions").select("session_id").eq("session_id", sessionId).eq("user_id", userId).maybeSingle(),
      // 최근 대화(최대 20개, HISTORY_MESSAGE_LIMIT)를 답변 생성 문맥으로 사용(분류기는 그중 최근 4개만 쓴다)
      admin
        .from("chat_messages")
        .select("role, content")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_MESSAGE_LIMIT),
    ]);
    if (!data) sessionId = null; // 남의 세션이거나 존재하지 않음 → 새로 만든다(위에서 읽은 대화는 쓰지 않는다)
    else recentMessages = ((rows ?? []).reverse()) as { role: "user" | "assistant"; content: string }[];
  }
  if (!sessionId) {
    const { data, error } = await admin.from("chat_sessions").insert({ user_id: userId }).select("session_id").single();
    if (error || !data) return NextResponse.json({ error: "대화를 시작할 수 없습니다." }, { status: 500 });
    sessionId = data.session_id;
  }
  if (!sessionId) return NextResponse.json({ error: "대화를 시작할 수 없습니다." }, { status: 500 }); // TS 안전망(도달 안 함)

  timer.lap("session_history");

  // 2026-10-16(채팅 속도 개선): 검색용 임베딩(사용자 메시지 원문만 입력)은 안전 분류 결과와 무관해서, 분류를 기다리는 동안 미리 시작해 둔다.
  // 안전 원칙: 위기·폭력이 키워드로 즉시 판정되는 메시지는 AI 호출 없이 끝나야 하므로(CLAUDE.md §5) 그런 메시지에는 시작하지 않는다.
  // 분류기가 위기·폭력으로 판정하면 이 결과는 쓰이지 않고 버려진다(분류기도 같은 메시지를 같은 업체로 보내므로 새로 노출되는 정보는 없다).
  const { rules: earlyRules } = await getSafetyData();
  const queryEmbedding = instantHit(findKeywordHits(message, earlyRules)) ? undefined : embedQuery(message);
  queryEmbedding?.catch(() => undefined); // 쓰이지 않고 끝나는 경우에도 "처리되지 않은 오류"가 남지 않게 표시만 해 둔다

  const decision = await determineRoute(message, recentMessages);
  timer.lap("classify");
  // 라우팅 메타데이터(route/confidence/source)는 민감정보가 아니라 응답에 그대로 포함한다.
  // 안전 평가 스크립트(scripts/safety-eval.mjs)가 이 값으로 실제 판정 품질을 확인한다.
  const routingMeta = {
    confidence: decision.confidence,
    source: decision.source,
    classifierUnavailable: decision.classifierUnavailable,
  };

  // 사용자 메시지는 판정 결과(route)와 함께 항상 저장한다.
  // 세션 안전 상태는 올라가기만 한다 (CLAUDE.md: 세션 중 자동으로 낮추지 않는다).
  const newFlag = safetyFlagFor(decision.route);
  // 메시지 저장과 세션 상태 조회는 서로 필요하지 않아 동시에 한다(2026-10-16).
  // 2026-10-18: 발화 해석이 이 메시지를 가리킬 수 있게 id를 먼저 정해 저장한다(사건 id에 쓰인다).
  const userMessageId = crypto.randomUUID();
  const [, { data: session }] = await Promise.all([
    admin.from("chat_messages").insert({
      message_id: userMessageId,
      session_id: sessionId,
      user_id: userId,
      role: "user",
      content: message,
      route: decision.route,
    }),
    admin.from("chat_sessions").select("safety_flag, topic_tag").eq("session_id", sessionId).single(),
  ]);
  const currentRank = session ? FLAG_RANK[session.safety_flag as keyof typeof FLAG_RANK] : 0;
  await admin
    .from("chat_sessions")
    .update({
      last_message_at: new Date().toISOString(),
      ...(FLAG_RANK[newFlag] > currentRank ? { safety_flag: newFlag } : {}),
      // 대화 목록에서 "대략 무슨 내용인지" 보여줄 용도 — 세션의 첫 메시지로 한 번만 정해둔다.
      ...(session && !session.topic_tag ? { topic_tag: makeTopicTag(message) } : {}),
    })
    .eq("session_id", sessionId);

  timer.lap("save_user_and_session");

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

  // route 3~7만 무료체험/이용권을 확인한다 (crisis·violence·classifierUnavailable은 이미 위에서
  // 반환됨 — 위기·폭력 대응은 결제 여부와 무관하게 항상 응답해야 한다). 가입 후 7일은 무료,
  // 그 후엔 활성 이용권(chat_entitlements.status='active')이 있어야 한다.
  // 이용권 확인·하루 사용량·대화당 메시지 수는 서로 필요하지 않아 한꺼번에 조회한다(2026-10-16). 판단 순서(이용권 → 하루 → 대화당)는 아래에서 그대로 지킨다.
  // 방금 저장한 이번 메시지도 포함해서 세어, count가 제한을 넘으면 이번 메시지는 생성 없이 막는다.
  const [access, { count: todayCount }, { count: sessionUserCount }] = await Promise.all([
    loadAccessStatus(admin, userId),
    admin
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user")
      .not("route", "in", "(crisis,violence)")
      .gte("created_at", startOfTodayKST().toISOString()),
    // route 3~7만 "한 대화당 사용자 메시지 20개" 상한을 적용한다(위기·폭력·분류기 장애 응답은 이미 위에서 반환되었고, 이 집계에서도
    // 그 두 route는 제외한다 — 위기 대응은 상한과 무관하게 항상 동작).
    admin
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("role", "user")
      .not("route", "in", "(crisis,violence)"),
  ]);
  if (!access.allowed) {
    const reply = "무료체험 기간이 끝났어요. 이용권을 구매하시면 계속 대화를 나눌 수 있어요.";
    await admin
      .from("chat_messages")
      .insert({ session_id: sessionId, user_id: userId, role: "assistant", content: reply, route: decision.route });
    return NextResponse.json({
      sessionId,
      route: decision.route,
      reply,
      done: true,
      paywallBlocked: true,
      ...routingMeta,
    });
  }

  // route 3~7만 하루 사용량 제한을 적용한다(crisis·violence·classifierUnavailable은 이미 위에서 반환됨).
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

  // 상한을 넘은 메시지는 AI 호출 없이 고정 안내만 돌려준다(비용 없음). 클라이언트는 sessionLimitReached를 보고 새 대화 안내 팝업을 띄운다.
  const sessionLimit = sessionLimitState(sessionUserCount ?? 0);
  timer.lap("access_and_limits");
  if (sessionLimit.blocked) {
    await admin
      .from("chat_messages")
      .insert({ session_id: sessionId, user_id: userId, role: "assistant", content: SESSION_LIMIT_REPLY, route: decision.route });
    return NextResponse.json({
      sessionId,
      route: decision.route,
      reply: SESSION_LIMIT_REPLY,
      done: true,
      sessionLimitReached: true,
      ...routingMeta,
    });
  }

  // route 3~7: 실제 검색 → 프롬프트 조립 → 생성 → 출력 검사.
  const { rules: safetyRules } = await getSafetyData();
  // 이론 질문 선택 흐름(준비 단계). 기능이 꺼져 있으면(기본값) 즉시 빈 계획을 돌려주고 아무 조회도 하지 않는다.
  const dialogue = await planDialogue({
    admin,
    userId,
    sessionId,
    route: decision.route,
    isPersonaQuestion,
    choiceId,
    message,
    recentMessages,
  });
  timer.lap("dialogue_plan");
  // 2026-10-18(개발 1·2·5번): 해석이 쌓인 뿌리가 있으면 이번 답변에 "이런 마음일 수도 있을까요?" 확인 문장을 건넨다(2~4번째 답변까지).
  // 이론 질문 선택 흐름이 이번 턴을 쓰고 있으면 겹치지 않는다. 실패하면 말하지 않고 평소처럼 답한다.
  const hypothesis = await planHypothesis({
    admin,
    userId,
    sessionId,
    route: decision.route,
    recentMessages,
    theoryActive: dialogue.generationExtras.dialogueMode !== undefined,
  });
  timer.lap("hypothesis_plan");
  const result = await generateAnswer({
    route: decision.route,
    matchedRuleIds: decision.matchedRuleIds,
    message,
    recentMessages,
    safetyRules,
    userId,
    sessionId,
    isPersonaQuestion,
    queryEmbedding,
    timer,
    ...dialogue.generationExtras,
    ...hypothesis?.generationExtras,
  });
  timer.lap("generate_total");

  // 탐색 턴이면 AI가 쓴 앞부분에 DB의 검수된 질문/실천을 붙여 최종 답변을 만든다(그 외에는 그대로).
  const finalReply = hypothesis ? await hypothesis.compose(result.reply, result.usedFallback) : await dialogue.compose(result.reply, result.usedFallback);

  await admin.from("chat_messages").insert({
    session_id: sessionId,
    user_id: userId,
    role: "assistant",
    content: finalReply,
    route: decision.route,
    retrieved_chunk_ids: result.retrievedChunkIds.length ? result.retrievedChunkIds : null,
    framework_id: result.frameworkId,
    ...dialogue.logFields(),
    ...hypothesis?.logFields(),
  });

  // 이번 답변이 저장된 뒤에야 상태를 저장하고, 안내(선택 칩/연장 칩)를 보낼 차례면 그 메시지를 이어서 저장한다.
  timer.lap("save_assistant");
  const { followUp } = await dialogue.finalize({ usedFallback: result.usedFallback });

  // 2026-10-18: 발화 해석(CSO 해석 엔진) — 답변을 보낸 뒤 뒤에서 돌고 결과는 다음 턴부터 반영된다(지연 0). 기본 꺼짐:
  // SW_INTERP_ENABLED=1 이고 SW_INTERP_ALLOWLIST에 있는 사용자만. 실패해도 채팅에는 영향이 없다(lib/interp/run.ts).
  const lastBot = [...recentMessages].reverse().find((m) => m.role === "assistant")?.content ?? null;
  after(() => runInterpretation({ userId, sessionId, messageId: userMessageId, text: message, route: decision.route, lastBot }));

  const usageTotals = result.usage.reduce(
    (acc, u) => ({ inputTokens: acc.inputTokens + u.inputTokens, outputTokens: acc.outputTokens + u.outputTokens }),
    { inputTokens: 0, outputTokens: 0 },
  );

  return NextResponse.json({
    sessionId,
    route: decision.route,
    reply: finalReply,
    done: true,
    remainingToday: Math.max(DAILY_MESSAGE_LIMIT - (todayCount ?? 0), 0),
    // 이번이 이 대화의 마지막으로 허용되는 메시지(20번째)면 true — 답변이 다 보인 뒤 새 대화 안내 팝업을 띄운다.
    ...(sessionLimit.reached ? { sessionLimitReached: true } : {}),
    ...(followUp ? { followUp } : {}),
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
