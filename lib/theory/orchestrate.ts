import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { RouteId } from "@/lib/safety/types";
import { detectTraumaStage, type TraumaStage } from "@/lib/safety/traumaStage";
import { checkOutput } from "@/lib/safety/outputCheck";
import { hasCrisisHistory } from "@/lib/safety/crisisHistory";
import { loadOnboardingPrefs } from "@/lib/onboarding/loadOnboardingPrefs";
import { pickCommitPractices } from "@/lib/rag/practicesSearch";
import { getTheoryConfig } from "./config";
import {
  DEFAULT_MAX_EXPLORE_TURNS,
  afterActionTurn,
  afterOffer,
  decideTurn,
  endFlow,
  endForUnsafeRoute,
  extendExplore,
  isDialogueRouteAllowed,
  parseDialogueState,
  startExplore,
  stepExplore,
  withTheory,
  type DialogueState,
} from "./dialogueState";
import { composeCommitReply, composeExploreReply, stripQuestions } from "./compose";
import { detectTheoryExclusion } from "./exclusion";
import { detectTextIntent } from "./intent";
import {
  EXTENSION_CHOICES,
  EXTENSION_LEAD,
  IMPLICIT_EXPLORE_NOTICE,
  NEUTRAL_OPEN_QUESTION,
  OFFER_CHOICES,
  buildOfferMessage,
} from "./offer";
import { loadTheoryGuide, type LoadedGuide } from "./loadGuide";
import { selectTheory } from "./selectTheory";
import type { Choice, ChoiceId, TheoryGuide } from "./types";

// 선택 흐름 한 턴의 계획. route.ts는 이 값으로 (1) 생성 옵션을 넘기고 (2) 생성된 답변을 합성하고 (3) 저장 뒤 마무리한다.
// 기능이 꺼져 있거나 이 턴이 흐름과 무관하면 NOOP이라 기존 동작이 한 글자도 바뀌지 않는다.
export type DialogueGenerationExtras = {
  dialogueMode?: "offer_follows" | "action" | "explore" | "explore_lead" | "commit_lead";
  theoryGuide?: TheoryGuide | null;
};

export type FollowUp = { text: string; choices: readonly Choice[] };

export type DialogueLog = {
  theory_id?: string | null;
  dialogue_mode?: string | null;
  theory_chosen_by?: string | null;
};

export type DialoguePlan = {
  generationExtras: DialogueGenerationExtras;
  // 생성된 답변(앞부분)을 DB의 검수된 질문/실천과 합쳐 최종 답변으로 만든다. 생성이 대체 문구로 끝났으면 합성하지 않는다.
  compose: (reply: string, usedFallback: boolean) => Promise<string>;
  // 저장할 assistant 메시지에 더할 로그 컬럼(이론 id 등).
  logFields: () => DialogueLog;
  // 답변이 저장된 직후 호출한다. 상태를 저장하고, 안내 메시지(선택 칩/연장 칩)를 보낼 차례면 저장해서 돌려준다.
  // 어떤 실패도 답변 자체에는 영향을 주지 않는다.
  finalize: (result: { usedFallback: boolean }) => Promise<{ followUp?: FollowUp }>;
};

const NOOP: DialoguePlan = {
  generationExtras: {},
  compose: async (reply) => reply,
  logFields: () => ({}),
  finalize: async () => ({}),
};

type Admin = ReturnType<typeof createAdminClient>;
type Ids = { userId: string; sessionId: string; route: RouteId };

async function readState(admin: Admin, sessionId: string): Promise<DialogueState | null> {
  const { data, error } = await admin.from("chat_sessions").select("dialogue_state").eq("session_id", sessionId).maybeSingle();
  // 컬럼이 아직 없으면(마이그레이션 전) 이 기능은 조용히 꺼진 것과 같게 동작한다.
  if (error) {
    console.warn("dialogue_state 조회 실패(마이그레이션 전일 수 있음):", error.message);
    return null;
  }
  return parseDialogueState(data?.dialogue_state);
}

async function saveState(admin: Admin, sessionId: string, state: DialogueState): Promise<void> {
  const { error } = await admin.from("chat_sessions").update({ dialogue_state: state }).eq("session_id", sessionId);
  if (error) console.warn("dialogue_state 저장 실패:", error.message);
}

async function loadNickname(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("nickname, display_name").eq("user_id", userId).maybeSingle();
  return data?.nickname || data?.display_name || null;
}

// 안내 메시지(선택 칩/연장 칩)를 assistant 메시지로 저장한다. 저장에 실패하면 칩을 보내지 않는다(기록에 없는 칩이 화면에만 남지 않게).
async function saveGuidanceMessage(admin: Admin, ids: Ids, text: string): Promise<boolean> {
  const { error } = await admin.from("chat_messages").insert({
    session_id: ids.sessionId,
    user_id: ids.userId,
    role: "assistant",
    content: text,
    route: ids.route,
  });
  if (error) console.warn("안내 메시지 저장 실패, 이번엔 보내지 않음:", error.message);
  return !error;
}

// "행동 제안받기 / 내 고민 더 알아보기" 흐름의 한 턴을 계획한다. 기능이 꺼져 있으면(기본값) DB 조회도 동작 변경도 없다.
export async function planDialogue(params: {
  admin: Admin;
  userId: string;
  sessionId: string;
  route: RouteId;
  isPersonaQuestion: boolean;
  choiceId: ChoiceId | null;
  message: string;
  recentMessages: { role: "user" | "assistant"; content: string }[];
  env?: Record<string, string | undefined>;
}): Promise<DialoguePlan> {
  const config = getTheoryConfig(params.env);
  if (!config.enabled) return NOOP;

  try {
    const { admin, sessionId, userId } = params;
    const state = await readState(admin, sessionId);
    if (!state) return NOOP;

    // 허용 경로 밖이면(임상·위기·폭력·서비스 문의·성향 질문) 이 흐름을 열지 않고, 진행 중이던 것은 끝낸다.
    if (!isDialogueRouteAllowed(params.route) || params.isPersonaQuestion) {
      const ended = endForUnsafeRoute(state);
      if (ended !== state) await saveState(admin, sessionId, ended);
      return NOOP;
    }

    const recentUser = params.recentMessages.filter((m) => m.role === "user").map((m) => m.content);
    const userTurn = recentUser.length + 1;
    const traumaStage = detectTraumaStage(params.message, recentUser);
    const turn = decideTurn({
      state,
      userTurn,
      choiceId: params.choiceId,
      textIntent: detectTextIntent(params.message),
      implicitExplore: config.implicitExplore,
    });

    // 지금 압도되어 있다는 신호(T1)가 있으면 탐색·선택 안내를 모두 멈추고 흐름을 끝낸다 — 답변은 평소 경로의
    // 트라우마 T1 대응(안정화 안내 + 전문가 도움)이 맡는다.
    if (traumaStage === "T1" && turn.kind !== "none") {
      if (state.mode !== "done") await saveState(admin, sessionId, endFlow(state));
      return NOOP;
    }

    // 사별·질병·생활고·직장 폭언·폭력/통제 관계·판정 요청·용서 질문 같은 "이론 제외 조건"(재판정 2026-10-07)에서는 탐색을 열지 않고 끝낸다.
    // 행동 제안(action)은 이론 없이 일반 실천 제안이라 그대로 허용한다(실천 쪽 필터는 별도).
    if (detectTheoryExclusion(params.message, recentUser) && turn.kind !== "action" && turn.kind !== "none") {
      if (state.mode !== "done" && turn.kind !== "offer") await saveState(admin, sessionId, endFlow(state));
      return NOOP;
    }

    const ids: Ids = { userId, sessionId, route: params.route };
    const userMessages = [...recentUser, params.message];

    switch (turn.kind) {
      case "none":
        return NOOP;

      case "end":
      case "finish":
        await saveState(admin, sessionId, endFlow(state));
        return NOOP;

      case "offer":
        return {
          generationExtras: { dialogueMode: "offer_follows" },
          compose: async (reply) => reply,
          logFields: () => ({ dialogue_mode: "offer_follows" }),
          finalize: async ({ usedFallback }) => {
            if (usedFallback) return {};
            const text = buildOfferMessage(await loadNickname(admin, userId));
            if (!(await saveGuidanceMessage(admin, ids, text))) return {};
            await saveState(admin, sessionId, afterOffer(state, userTurn));
            return { followUp: { text, choices: OFFER_CHOICES } };
          },
        };

      case "action":
        return {
          generationExtras: { dialogueMode: "action" },
          compose: async (reply) => reply,
          logFields: () => ({ dialogue_mode: "action" }),
          finalize: async ({ usedFallback }) => {
            if (!usedFallback) await saveState(admin, sessionId, afterActionTurn(state));
            return {};
          },
        };

      case "explore_start":
      case "explore_turn":
      case "extend": {
        let working = state;
        let implicitNotice = false;
        if (turn.kind === "explore_start") {
          working = startExplore(state, turn.implicit);
          implicitNotice = turn.implicit;
        } else if (turn.kind === "extend") {
          working = extendExplore(state);
        }
        // 이론은 탐색 시작 때 한 번 고른다. 못 골랐으면(null) 이론 없이 일반 탐색을 하다가 두 번째 턴에 한 번 더 시도한다.
        if (!working.theoryId && (working.chosenBy === null || (working.chosenBy === "none" && working.exploreTurns === 1))) {
          const picked = await selectTheory(admin, { userMessages, route: params.route });
          working = withTheory(working, picked, picked ? "llm" : "none");
        }
        return await planExploreTurn({ admin, ids, working, message: params.message, traumaStage, userMessages, assistantMessages: params.recentMessages.filter((m) => m.role === "assistant").map((m) => m.content), implicitNotice });
      }
    }
  } catch (e) {
    console.warn("이론 질문 흐름 계획 실패, 평소 대화로 진행:", e instanceof Error ? e.message : e);
    return NOOP;
  }
}

async function planExploreTurn(args: {
  admin: Admin;
  ids: Ids;
  working: DialogueState;
  message: string;
  traumaStage: TraumaStage | null;
  userMessages: string[];
  assistantMessages: string[];
  implicitNotice: boolean;
}): Promise<DialoguePlan> {
  const { admin, ids, working, message, traumaStage, userMessages, assistantMessages, implicitNotice } = args;
  const theoryId = working.theoryId;

  // 단계(OPEN/CLARIFY/REFRAME/COMMIT)는 stepExplore가 정하고, 그 단계에 맞는 질문은 이론 DB에서 가져온다.
  // 상한 턴 수(maxTurns)는 이론마다 달라서 먼저 한 번 읽어야 한다.
  let loaded: LoadedGuide | null = null;
  let maxTurns = DEFAULT_MAX_EXPLORE_TURNS;
  if (theoryId) {
    loaded = await loadTheoryGuide(admin, { theoryId, stage: working.stage, askedQuestionIds: working.askedQuestionIds, traumaStage });
    maxTurns = loaded.maxTurns;
  }
  const stage = stepExplore(working, message, maxTurns, null).stage;
  if (theoryId && loaded && stage !== working.stage) {
    loaded = await loadTheoryGuide(admin, { theoryId, stage, askedQuestionIds: working.askedQuestionIds, traumaStage });
  }
  const isCommit = stage === "COMMIT";
  const guide = loaded?.guide ?? null;
  // COMMIT 단계는 질문을 쓰지 않으므로 질문을 "물어본 것"으로 기록하지 않는다.
  const step = stepExplore(working, message, maxTurns, isCommit ? null : loaded?.questionId ?? null);

  // 이번 턴에 시스템이 붙일 질문(이론 DB의 검수된 질문 원문, 이론이 없는 첫 턴이면 중립 질문).
  const systemQuestion = isCommit ? null : guide?.question ?? (stage === "OPEN" && !theoryId ? NEUTRAL_OPEN_QUESTION : null);

  let practices: { title: string; reason: string | null }[] = [];
  if (isCommit && theoryId) {
    try {
      const { prefs } = await loadOnboardingPrefs(admin, ids.userId);
      practices = await pickCommitPractices({
        theoryId,
        messages: userMessages,
        onboardingPrefs: prefs,
        serving: { hasCrisisHistory: await hasCrisisHistory(admin, ids.userId) },
        traumaStage,
        alreadyShownText: assistantMessages.join("\n"),
      });
    } catch (e) {
      console.warn("탐색 마무리 실천 고르기 실패, 일반 행동 제안으로 대체:", e instanceof Error ? e.message : e);
    }
  }

  // 생성 모드: 질문을 시스템이 붙이는 턴이면 AI는 앞부분만(explore_lead), COMMIT은 정리 문장만(commit_lead).
  // 이론이 없거나 질문이 바닥났으면 AI가 질문 하나를 직접 만든다(explore). 실천을 못 고른 COMMIT은 일반 행동 제안(action)으로 마무리한다.
  let dialogueMode: NonNullable<DialogueGenerationExtras["dialogueMode"]>;
  if (isCommit) dialogueMode = practices.length ? "commit_lead" : "action";
  else dialogueMode = systemQuestion ? "explore_lead" : "explore";

  const guideForPrompt: TheoryGuide | null =
    dialogueMode === "explore_lead" || dialogueMode === "commit_lead"
      ? guide ?? (loaded ? { plainFocus: loaded.theoryFocus ?? "", stage, question: "", intent: null, growthFrame: null, voiceCard: loaded.voiceCard } : null)
      : null;

  let advance = true;
  return {
    generationExtras: { dialogueMode, theoryGuide: guideForPrompt },
    compose: async (reply, usedFallback) => {
      if (usedFallback) {
        advance = false;
        return reply;
      }
      let text = reply;
      if (dialogueMode === "explore_lead" && systemQuestion) text = composeExploreReply(reply, systemQuestion);
      else if (dialogueMode === "commit_lead") text = composeCommitReply(reply, practices);
      // 앞부분은 AI가 쓰지만 질문·실천은 DB 문구라, 합친 결과도 출력 검수를 한 번 더 통과해야 한다.
      // 걸리면 AI가 쓴 앞부분만 보내고 이번 턴은 진행으로 치지 않는다(같은 단계를 다음 턴에 다시 시도).
      if (text !== reply && !checkOutput(text, { usedClinicalChunk: false, clinicalBoundaryAlreadyStated: true }).ok) {
        console.warn("합성된 탐색 답변이 출력 검사에 걸림, 앞부분만 사용");
        advance = false;
        return stripQuestions(reply) || reply;
      }
      return implicitNotice ? `${IMPLICIT_EXPLORE_NOTICE}\n\n${text}` : text;
    },
    logFields: () => ({ theory_id: theoryId, dialogue_mode: `${dialogueMode}:${stage}`, theory_chosen_by: working.chosenBy }),
    finalize: async ({ usedFallback }) => {
      if (usedFallback || !advance) {
        // 진행하지 않는다. 다만 이번 턴에 이론을 새로 골랐다면 그 값은 남겨 다음 턴에 다시 고르지 않게 한다.
        await saveState(admin, ids.sessionId, working);
        return {};
      }
      await saveState(admin, ids.sessionId, step.nextState);
      if (!step.offerExtension) return {};
      if (!(await saveGuidanceMessage(admin, ids, EXTENSION_LEAD))) {
        // 연장 칩을 못 보냈으면 사용자가 칩 없이 이어가도 되도록 대기 상태를 풀어 둔다.
        await saveState(admin, ids.sessionId, { ...step.nextState, pendingExtension: false });
        return {};
      }
      return { followUp: { text: EXTENSION_LEAD, choices: EXTENSION_CHOICES } };
    },
  };
}
