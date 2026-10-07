import type { ChoiceId, TheoryStage } from "./types.ts";
import { THEORY_STAGES } from "./types.ts";
import type { TextIntent } from "./intent.ts";
import { declaresNextStep, isVagueAnswer } from "./intent.ts";
import type { RouteId } from "../safety/types.ts";

// 세션 하나의 "행동 제안 vs 고민 더 알아보기" 진행 상태(chat_sessions.dialogue_state, jsonb). 모든 전이는 순수 함수라
// 네트워크 없이 테스트할 수 있다(dialogueState.test.ts). 2026-10-06 새 구조(이론 기반 탐색 v0.9 D1~D4):
//  - 선택 칩(행동 제안받기 / 내 고민 더 알아보기)은 사용자가 두 번째 말을 했을 때 **항상** 보여준다(이론 매칭과 무관).
//  - 칩을 안 누르고 말을 이어가면 그 말에 답하면서 칩을 한 번 더 보여주고, 그래도 이어가면 탐색으로 넘어간다(D1).
//  - 탐색: OPEN → CLARIFY(답이 막연하면 한 번 더) → REFRAME → COMMIT. 기본 4~5턴, 상한 max_explore_turns(6). COMMIT 뒤 연장 칩.
export type DialogueMode = "undecided" | "action" | "explore" | "done";

export type DialogueState = {
  mode: DialogueMode;
  offerCount: number; // 선택 안내를 보낸 횟수(0~2)
  offeredAtUserTurn: number | null;
  theoryId: string | null; // 탐색에 쓰는 이론(없으면 이론 없는 일반 탐색)
  chosenBy: "llm" | "none" | null; // 이론을 정한 방식(로그용)
  stage: TheoryStage;
  exploreTurns: number; // 탐색에서 AI가 답한 횟수
  clarifyCount: number;
  extensionsUsed: number;
  pendingExtension: boolean; // 직전 턴(COMMIT)에 연장 칩을 보냈다
  askedQuestionIds: string[];
  implicit: boolean; // 칩 없이 말을 이어가서 시작된 탐색인지(로그용)
};

export const EMPTY_STATE: DialogueState = {
  mode: "undecided",
  offerCount: 0,
  offeredAtUserTurn: null,
  theoryId: null,
  chosenBy: null,
  stage: "OPEN",
  exploreTurns: 0,
  clarifyCount: 0,
  extensionsUsed: 0,
  pendingExtension: false,
  askedQuestionIds: [],
  implicit: false,
};

const MODES: readonly DialogueMode[] = ["undecided", "action", "explore", "done"];
export const MAX_OFFERS = 2;
export const MAX_EXTENSIONS = 2;
export const DEFAULT_MAX_EXPLORE_TURNS = 6;

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function int(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
}

// DB에서 읽은 값을 믿지 않고 모양을 확인한다. 이상하면 빈 상태로 돌아간다(= 아무 일도 안 일어남).
export function parseDialogueState(raw: unknown): DialogueState {
  if (!raw || typeof raw !== "object") return { ...EMPTY_STATE };
  const o = raw as Record<string, unknown>;
  return {
    mode: MODES.includes(o.mode as DialogueMode) ? (o.mode as DialogueMode) : "undecided",
    offerCount: Math.min(int(o.offerCount), MAX_OFFERS),
    offeredAtUserTurn: typeof o.offeredAtUserTurn === "number" ? o.offeredAtUserTurn : null,
    theoryId: typeof o.theoryId === "string" ? o.theoryId : null,
    chosenBy: o.chosenBy === "llm" || o.chosenBy === "none" ? o.chosenBy : null,
    stage: THEORY_STAGES.includes(o.stage as TheoryStage) ? (o.stage as TheoryStage) : "OPEN",
    exploreTurns: int(o.exploreTurns),
    clarifyCount: int(o.clarifyCount),
    extensionsUsed: Math.min(int(o.extensionsUsed), MAX_EXTENSIONS),
    pendingExtension: o.pendingExtension === true,
    askedQuestionIds: strArray(o.askedQuestionIds),
    implicit: o.implicit === true,
  };
}

export function isChoiceId(v: unknown): v is ChoiceId {
  return v === "action" || v === "explore" || v === "extend" || v === "finish";
}

// 이 흐름이 열릴 수 있는 route. 임상(진단/우울·공황·트라우마)·위기·폭력·서비스 문의에서는 절대 열지 않는다.
export const DIALOGUE_ALLOWED_ROUTES: readonly RouteId[] = ["wellness", "life_decision"];
export function isDialogueRouteAllowed(route: RouteId): boolean {
  return DIALOGUE_ALLOWED_ROUTES.includes(route);
}

// 사용자가 두 번째 말을 했을 때 선택 안내를 보낸다(owner: "2~3번 정도 질문했을 때", 문서 D2: 항상).
export const OFFER_USER_TURN = 2;

// 이번 사용자 메시지에 대한 계획.
export type TurnPlan =
  | { kind: "none" } // 평소 대화
  | { kind: "offer"; offerNo: number } // 평소처럼 답하되 질문으로 끝내지 않고, 답변 뒤에 선택 안내를 붙인다
  | { kind: "action" } // 행동 제안(이번 한 턴)
  | { kind: "explore_start"; implicit: boolean } // 탐색 시작(OPEN)
  | { kind: "explore_turn" } // 탐색 계속(CLARIFY/REFRAME/COMMIT)
  | { kind: "extend" } // COMMIT 뒤 "조금 더 이야기할래요"
  | { kind: "finish" } // COMMIT 뒤 "이걸로 해볼게요" — 탐색을 마친다
  | { kind: "end" }; // 흐름을 끝낸다(평소 대화로)

export type TurnInput = {
  state: DialogueState;
  userTurn: number; // 이번 메시지를 포함한 이 세션의 사용자 메시지 번호(1부터)
  choiceId: ChoiceId | null;
  textIntent: TextIntent;
  implicitExplore: boolean; // 설정: 칩 없이 말을 이어가면 탐색으로 간주할지(기본 켜짐)
};

export function decideTurn(i: TurnInput): TurnPlan {
  const { state, userTurn, choiceId, textIntent } = i;

  // 사용자가 그만하자고 하면 언제나 즉시 끝낸다(안전한 쪽).
  if (textIntent === "stop") return state.mode === "done" ? { kind: "none" } : { kind: "end" };
  if (state.mode === "done") return { kind: "none" };

  if (state.mode === "explore") {
    if (state.pendingExtension) {
      if (choiceId === "finish") return { kind: "finish" };
      // 칩 없이 말을 이어가면 "조금 더 이야기하고 싶다"로 본다(연장 칩의 의미와 같다).
      return { kind: "extend" };
    }
    if (choiceId === "action") return { kind: "action" }; // 탐색 중에도 행동 제안으로 갈아탈 수 있다
    return { kind: "explore_turn" };
  }

  // mode === "undecided" (또는 action이 이미 끝난 뒤는 done으로 저장되므로 여기엔 안 옴)
  if (state.offerCount > 0) {
    // 제안을 받은 뒤: 칩을 눌렀거나, 글로 의도를 말했거나, 아니면 그냥 말을 이어간 것
    if (choiceId === "action" || textIntent === "action") return { kind: "action" };
    if (choiceId === "explore" || textIntent === "explore") return { kind: "explore_start", implicit: false };
    if (state.offerCount < MAX_OFFERS) return { kind: "offer", offerNo: state.offerCount + 1 }; // 한 번만 다시 보여준다
    return i.implicitExplore ? { kind: "explore_start", implicit: true } : { kind: "none" };
  }

  if (choiceId === "action" || choiceId === "explore") return { kind: "none" }; // 제안을 받은 적 없는 조작된 요청 — 일반 메시지로
  if (userTurn === OFFER_USER_TURN) return { kind: "offer", offerNo: 1 };
  return { kind: "none" };
}

// ---- 상태 전이 ----------------------------------------------------------------------------------

export function afterOffer(state: DialogueState, userTurn: number): DialogueState {
  return { ...state, offerCount: Math.min(state.offerCount + 1, MAX_OFFERS), offeredAtUserTurn: state.offeredAtUserTurn ?? userTurn };
}

export function startExplore(state: DialogueState, implicit: boolean): DialogueState {
  return { ...state, mode: "explore", stage: "OPEN", exploreTurns: 0, clarifyCount: 0, pendingExtension: false, askedQuestionIds: [], implicit };
}

export function withTheory(state: DialogueState, theoryId: string | null, chosenBy: "llm" | "none"): DialogueState {
  return { ...state, theoryId, chosenBy };
}

export function endFlow(state: DialogueState): DialogueState {
  return { ...state, mode: "done", pendingExtension: false };
}

export function afterActionTurn(state: DialogueState): DialogueState {
  return endFlow(state);
}

// 안전 라우터가 이번 메시지를 허용 경로 밖(임상·위기 등)으로 판단했을 때: 진행 중이던 흐름을 끝낸다.
// (제안만 받고 아직 고르지 않은 상태도 끝낸다 — 나중에 이미 지나간 안내의 칩으로 탐색이 시작되면 안 된다.)
export function endForUnsafeRoute(state: DialogueState): DialogueState {
  if (state.mode === "explore" || (state.mode === "undecided" && state.offerCount > 0)) return endFlow(state);
  return state;
}

export type ExploreStep = {
  stage: TheoryStage; // 이번 턴에 쓰는 단계
  nextState: DialogueState;
  offerExtension: boolean; // 이번 턴이 끝난 뒤 연장 칩을 보낼지(COMMIT 뒤)
  finished: boolean; // 이번 턴으로 탐색이 끝난다
};

// 탐색 한 턴을 진행한다. userMessage는 이번 사용자 말(막연한 답인지·다음 걸음을 말했는지 판단용).
// 단계 규칙(문서 4-2 ②-1·②-2): OPEN → CLARIFY(막연한 답이면 한 번 더) → REFRAME → COMMIT → (연장 0~2회 후 마침).
// 사용자가 CLARIFY/REFRAME에서 이미 다음 걸음을 말하면 COMMIT으로 바로 넘어간다. 상한 턴(maxTurns)이 되면 이번 턴이 마지막이다.
export function stepExplore(state: DialogueState, userMessage: string, maxTurns: number, questionId: string | null): ExploreStep {
  const turn = state.exploreTurns + 1;
  const cap = Math.max(1, maxTurns);
  let stage: TheoryStage = state.stage;
  let clarifyCount = state.clarifyCount;

  // 이번 턴에 쓸 단계를 정한다(직전 단계에서 한 칸 넘어온 값이 state.stage에 들어 있다).
  if ((stage === "CLARIFY" || stage === "REFRAME") && declaresNextStep(userMessage)) stage = "COMMIT";
  if (turn >= cap) stage = "COMMIT"; // 상한에 닿았으면 정리로 마친다

  let next: TheoryStage = stage;
  if (stage === "OPEN") next = "CLARIFY";
  else if (stage === "CLARIFY") {
    // 답이 막연하면 질문 하나를 더 한다(한 번만).
    if (isVagueAnswer(userMessage) && clarifyCount < 1 && turn + 2 < cap) {
      clarifyCount += 1;
      next = "CLARIFY";
    } else next = "REFRAME";
  } else if (stage === "REFRAME") next = "COMMIT";

  const asked = questionId ? [...state.askedQuestionIds, questionId] : state.askedQuestionIds;
  if (stage === "COMMIT") {
    const canExtend = turn < cap - 1 && state.extensionsUsed < MAX_EXTENSIONS;
    const nextState: DialogueState = canExtend
      ? { ...state, stage: "COMMIT", exploreTurns: turn, clarifyCount, askedQuestionIds: asked, pendingExtension: true }
      : endFlow({ ...state, stage: "COMMIT", exploreTurns: turn, clarifyCount, askedQuestionIds: asked });
    return { stage, nextState, offerExtension: canExtend, finished: !canExtend };
  }
  return { stage, nextState: { ...state, stage: next, exploreTurns: turn, clarifyCount, askedQuestionIds: asked }, offerExtension: false, finished: false };
}

// COMMIT 뒤 "조금 더 이야기할래요": 같은 이론으로 CLARIFY → REFRAME → COMMIT을 한 번 더 한다.
export function extendExplore(state: DialogueState): DialogueState {
  return { ...state, stage: "CLARIFY", clarifyCount: 0, pendingExtension: false, extensionsUsed: Math.min(state.extensionsUsed + 1, MAX_EXTENSIONS) };
}
