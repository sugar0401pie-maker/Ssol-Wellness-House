import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { SafetyRule } from "@/lib/safety/rules";
import type { RouteId } from "@/lib/safety/types";
import { getTheoryConfig } from "./config";
import {
  afterActionTurn,
  afterExploreTurn,
  afterOffer,
  applyChoice,
  endForUnsafeRoute,
  parseDialogueState,
  type DialogueState,
} from "./dialogueState";
import { OFFER_CHOICES, buildOfferMessage, canOfferNow, isDialogueRouteAllowed } from "./offer";
import { findTheoryCandidate } from "./findCandidate";
import { loadTheoryGuide } from "./loadGuide";
import type { Choice, ChoiceId, TheoryGuide } from "./types";

export type DialogueGenerationExtras = {
  dialogueMode?: "offer_follows" | "action" | "explore";
  theoryGuide?: TheoryGuide | null;
};

export type FollowUp = { text: string; choices: readonly Choice[] };

export type DialoguePlan = {
  generationExtras: DialogueGenerationExtras;
  // 이번 답변이 저장된 직후에 호출한다. 상태를 저장하고, 선택 안내를 보낼 차례면 그 메시지를
  // 저장해서 돌려준다. 어떤 실패도 답변 자체에는 영향을 주지 않는다.
  finalize: () => Promise<{ followUp?: FollowUp }>;
};

const NOOP: DialoguePlan = { generationExtras: {}, finalize: async () => ({}) };

async function readState(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string,
): Promise<DialogueState | null> {
  const { data, error } = await admin.from("chat_sessions").select("dialogue_state").eq("session_id", sessionId).maybeSingle();
  // 컬럼이 아직 없으면(마이그레이션 전) 이 기능은 조용히 꺼진 것과 같게 동작한다.
  if (error) {
    console.warn("dialogue_state 조회 실패(마이그레이션 전일 수 있음):", error.message);
    return null;
  }
  return parseDialogueState(data?.dialogue_state);
}

async function saveState(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string,
  state: DialogueState,
): Promise<void> {
  const { error } = await admin.from("chat_sessions").update({ dialogue_state: state }).eq("session_id", sessionId);
  if (error) console.warn("dialogue_state 저장 실패:", error.message);
}

// "행동 제안받기 / 내 고민 더 알아보기" 흐름의 한 턴을 계획한다. 기능이 꺼져 있으면(기본값) DB 조회도,
// 동작 변경도 전혀 없다 — 이 함수는 즉시 NOOP을 돌려준다.
export async function planDialogue(params: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  sessionId: string;
  route: RouteId;
  isPersonaQuestion: boolean;
  choiceId: ChoiceId | null;
  message: string;
  recentMessages: { role: "user" | "assistant"; content: string }[];
  safetyRules: SafetyRule[];
  env?: Record<string, string | undefined>;
}): Promise<DialoguePlan> {
  const config = getTheoryConfig(params.env);
  if (!config.enabled) return NOOP;

  try {
    const { admin, sessionId } = params;
    const state = await readState(admin, sessionId);
    if (!state) return NOOP;

    // 허용 경로 밖이면(임상·위기·폭력·서비스 문의·성향 질문) 이 흐름을 열지 않고, 진행 중이던 것은 끝낸다.
    if (!isDialogueRouteAllowed(params.route) || params.isPersonaQuestion) {
      const ended = endForUnsafeRoute(state);
      if (ended !== state) await saveState(admin, sessionId, ended);
      return NOOP;
    }

    const userTurn = params.recentMessages.filter((m) => m.role === "user").length + 1;

    // (1) 사용자가 칩을 눌렀다.
    if (params.choiceId) {
      const chosen = applyChoice(state, params.choiceId);
      // 상태가 바뀌지 않은 선택(제안을 받은 적 없는 조작된 요청, 이미 끝난 흐름, 이미 탐색 중인데 같은 칩)은
      // 선택으로 취급하지 않고 아래의 일반 흐름으로 내려간다 — 그냥 사용자 메시지 하나로 처리된다.
      if (chosen !== state) {
        if (chosen.mode === "action") {
          return {
            generationExtras: { dialogueMode: "action" },
            finalize: async () => {
              await saveState(admin, sessionId, afterActionTurn(chosen));
              return {};
            },
          };
        }
        return planExploreTurn(admin, sessionId, chosen);
      }
    }

    // (2) 이미 탐색 중이고 사용자가 칩 없이 말을 이어갔다 → 다음 탐색 턴.
    if (state.mode === "explore") return planExploreTurn(admin, sessionId, state);

    // (3) 제안을 할 차례인지 본다(싼 조건 먼저 → 통과해야만 임베딩 검색).
    if (!canOfferNow({ enabled: true, route: params.route, isPersonaQuestion: false, userTurn, state })) return NOOP;

    const userMessages = [...params.recentMessages.filter((m) => m.role === "user").map((m) => m.content), params.message];
    const candidate = await findTheoryCandidate({
      userMessages,
      route: params.route,
      safetyRules: params.safetyRules,
      matcher: config.matcher,
    });
    if (!candidate) return NOOP;

    return {
      generationExtras: { dialogueMode: "offer_follows" },
      finalize: async () => {
        const nickname = await loadNickname(admin, params.userId);
        const text = buildOfferMessage(nickname);
        const { error } = await admin.from("chat_messages").insert({
          session_id: sessionId,
          user_id: params.userId,
          role: "assistant",
          content: text,
          route: params.route,
        });
        if (error) {
          console.warn("선택 안내 메시지 저장 실패, 이번엔 제안하지 않음:", error.message);
          return {};
        }
        await saveState(admin, sessionId, afterOffer(state, userTurn, candidate.theoryId, candidate.hitQuestionIds));
        return { followUp: { text, choices: OFFER_CHOICES } };
      },
    };
  } catch (e) {
    console.warn("이론 질문 흐름 계획 실패, 평소 대화로 진행:", e instanceof Error ? e.message : e);
    return NOOP;
  }
}

async function planExploreTurn(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string,
  state: DialogueState,
): Promise<DialoguePlan> {
  const loaded = await loadTheoryGuide(admin, state);
  return {
    generationExtras: { dialogueMode: "explore", theoryGuide: loaded.guide },
    finalize: async () => {
      await saveState(admin, sessionId, afterExploreTurn(state, loaded.questionId, loaded.stage, loaded.maxTurns));
      return {};
    },
  };
}

async function loadNickname(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("nickname, display_name").eq("user_id", userId).maybeSingle();
  return data?.nickname || data?.display_name || null;
}

