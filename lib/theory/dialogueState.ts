import type { ChoiceId, TheoryStage } from "./types.ts";
import { THEORY_STAGES } from "./types.ts";

// 세션 하나의 "이론 질문 제안" 진행 상태. chat_sessions.dialogue_state(jsonb)에 저장된다.
// 모든 전이는 순수 함수라 네트워크 없이 테스트할 수 있다(dialogueState.test.ts).
export type DialogueMode = "undecided" | "action" | "explore" | "done";

export type DialogueState = {
  mode: DialogueMode;
  offered: boolean; // 선택 안내를 이미 보냈는지(세션당 1회만)
  offeredAtUserTurn: number | null;
  theoryId: string | null;
  candidateQuestionIds: string[]; // 제안 시점에 매칭된 질문 — explore에서 우선 사용
  stage: TheoryStage;
  exploreTurns: number;
  askedQuestionIds: string[];
};

export const EMPTY_STATE: DialogueState = {
  mode: "undecided",
  offered: false,
  offeredAtUserTurn: null,
  theoryId: null,
  candidateQuestionIds: [],
  stage: "OPEN",
  exploreTurns: 0,
  askedQuestionIds: [],
};

const MODES: readonly DialogueMode[] = ["undecided", "action", "explore", "done"];

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

// DB에서 읽은 값을 믿지 않고 모양을 확인한다. 이상하면 빈 상태로 돌아간다(= 아무 일도 안 일어남).
export function parseDialogueState(raw: unknown): DialogueState {
  if (!raw || typeof raw !== "object") return { ...EMPTY_STATE };
  const o = raw as Record<string, unknown>;
  const mode = MODES.includes(o.mode as DialogueMode) ? (o.mode as DialogueMode) : "undecided";
  const stage = THEORY_STAGES.includes(o.stage as TheoryStage) ? (o.stage as TheoryStage) : "OPEN";
  return {
    mode,
    offered: o.offered === true,
    offeredAtUserTurn: typeof o.offeredAtUserTurn === "number" ? o.offeredAtUserTurn : null,
    theoryId: typeof o.theoryId === "string" ? o.theoryId : null,
    candidateQuestionIds: strArray(o.candidateQuestionIds),
    stage,
    exploreTurns: typeof o.exploreTurns === "number" && o.exploreTurns >= 0 ? o.exploreTurns : 0,
    askedQuestionIds: strArray(o.askedQuestionIds),
  };
}

export function isChoiceId(v: unknown): v is ChoiceId {
  return v === "action" || v === "explore";
}

export function afterOffer(
  state: DialogueState,
  userTurn: number,
  theoryId: string,
  candidateQuestionIds: string[],
): DialogueState {
  return { ...state, offered: true, offeredAtUserTurn: userTurn, theoryId, candidateQuestionIds };
}

// 사용자가 칩을 눌렀을 때. 제안을 받은 적이 없으면(= 조작된 요청) 상태를 그대로 둔다.
// explore 중에 "행동 제안받기"로 갈아타는 것은 허용한다(언제든 전환 가능).
export function applyChoice(state: DialogueState, choice: ChoiceId): DialogueState {
  if (!state.offered) return state;
  if (choice === "action") {
    if (state.mode === "undecided" || state.mode === "explore") return { ...state, mode: "action" };
    return state;
  }
  if (state.mode === "undecided") {
    return { ...state, mode: "explore", stage: "OPEN", exploreTurns: 0, askedQuestionIds: [] };
  }
  return state;
}

export function nextStage(stage: TheoryStage): TheoryStage | null {
  const i = THEORY_STAGES.indexOf(stage);
  return i >= 0 && i < THEORY_STAGES.length - 1 ? THEORY_STAGES[i + 1] : null;
}

// explore에서 질문 하나를 던진 턴이 끝날 때 호출. 한 턴에 질문 하나, 단계는 OPEN→CLARIFY→REFRAME→COMMIT
// 순서로 한 칸씩 넘어가고, 최대 턴 수에 닿거나 COMMIT까지 마치면 "done"(= 평소 대화로 복귀)이 된다.
export function afterExploreTurn(
  state: DialogueState,
  askedQuestionId: string | null,
  usedStage: TheoryStage,
  maxTurns: number,
): DialogueState {
  if (state.mode !== "explore") return state;
  const exploreTurns = state.exploreTurns + 1;
  const askedQuestionIds = askedQuestionId ? [...state.askedQuestionIds, askedQuestionId] : state.askedQuestionIds;
  const next = nextStage(usedStage);
  if (exploreTurns >= maxTurns || next === null) {
    return { ...state, mode: "done", exploreTurns, askedQuestionIds, stage: usedStage };
  }
  return { ...state, exploreTurns, askedQuestionIds, stage: next };
}

// action은 "이번 한 턴만" 쓰는 지시다 — 그 답변이 나간 뒤에는 평소 대화로 돌아간다.
export function afterActionTurn(state: DialogueState): DialogueState {
  return state.mode === "action" ? { ...state, mode: "done" } : state;
}

// 안전 라우터가 이번 메시지를 허용 경로 밖(임상·위기 등)으로 판단했을 때: 진행 중이던 흐름을 끝낸다.
// (제안만 받고 아직 고르지 않은 상태도 끝낸다 — 나중에 이미 지나간 안내의 칩으로 탐색이 시작되면 안 된다.)
export function endForUnsafeRoute(state: DialogueState): DialogueState {
  if (state.mode === "explore" || (state.mode === "undecided" && state.offered)) {
    return { ...state, mode: "done" };
  }
  return state;
}
