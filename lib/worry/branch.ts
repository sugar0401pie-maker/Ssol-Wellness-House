// 첫 말 → 세부 고민 → 갈래(그렇게 느끼는 까닭) — 순수 함수(CSO 묶음 v2.32 · 엔진 worryMatch v0.10 · 규칙 WT-06·07, 2026-11-23).
// 갈래는 분류 모델이 첫 말에서 정하고(subBranchPrompt → parseSubBranch), 모델을 못 쓰면 낱말 맞춤(subBranchGuess)으로 짐작한다.
// 글에 까닭이 드러나지 않았으면(세부 코드-0) 첫 답변 뒤에 갈래 카드(branchCard — 기본 갈래 1~3위 + 다른 까닭이에요 + 잘 모르겠어요)로 묻는다.
// 갈래는 진단이 아니라 "이런 까닭일 수 있다"는 보기이고, 고른 갈래는 과제 후보를 고르는 데만 쓴다. 클라이언트도 타입을 쓰므로 "server-only"를 넣지 않는다.
import type { CardPayload } from "../cards/flow.ts";

export type BranchSource = "model" | "guess" | "card" | "none";
export type BranchPick = { branch_id: string; known: boolean; by: BranchSource; also?: string[] };

// 엔진 branchCard(intentId, more)의 결과 모양.
export type EngineBranchCard = { intent_id: string; ask: string; more: boolean; options: { id: string; text: string; option_id?: string | null }[] };

// chat_sessions.worry_pick.branch_card — 보여 준 갈래 카드(보기 id만). 답을 받으면 answered=true(같은 카드에 두 번 답하지 않게).
export type BranchCardState = { intent_id: string; shown: string[]; more: boolean; answered: boolean; at: string };

export const BRANCH_CARD_ID = "CC-BRANCH";
export const unknownBranch = (intentId: string) => `${intentId}-0`;
export const isKnownBranch = (b: { branch_id?: string | null; known?: boolean } | null | undefined): boolean => !!b?.known && !!b.branch_id && !/-0$/.test(b.branch_id);

// 모델 답(parseSubBranch 결과)과 예비 낱말 맞춤(subBranchGuess 결과)으로 갈래 하나를 정한다.
// 모델이 답했으면 그 답을 따른다(모델이 "글에 까닭이 없다"고 했으면 낱말 맞춤으로 뒤집지 않음 — 「② 꼭 있어야 하는 표현」 원칙). 모델이 실패했을 때만 낱말 맞춤.
export function decideBranch(
  intentId: string,
  model: { branch_id: string; known: boolean; also?: string[]; fallback?: string | null } | null,
  guess: { branch_id: string; known: boolean } | null,
): BranchPick {
  if (model && !model.fallback) return { branch_id: model.known ? model.branch_id : unknownBranch(intentId), known: model.known, by: model.known ? "model" : "none", also: model.also ?? [] };
  if (guess?.known) return { branch_id: guess.branch_id, known: true, by: "guess" };
  return { branch_id: unknownBranch(intentId), known: false, by: "none" };
}

// 2026-11-24 대표님 결정(A안): 엔진의 묻는 말("이 중에 지금 마음에 가까운 까닭이 있어요?" — 엔진 안내서에도 "초안")이 직관적이지 않아 화면 문구만 바꾼다(엔진 파일은 그대로).
export const BRANCH_ASK = "왜 그런 마음이 드는 것 같아요? 가장 가까운 걸 골라 주세요.";
export const BRANCH_ASK_MORE = "그럼 이 중에는 있나요?";
const OPTION_LABEL: Record<string, string> = { other: "다른 이유예요", unknown: "잘 모르겠어요" };

// 갈래 카드 → 화면 모양. 갈래 문장이 길어 한 줄씩 버튼으로 보인다(과제 카드와 같은 모양).
export function branchCardPayload(card: EngineBranchCard): CardPayload {
  return {
    kind: "branch", cardId: BRANCH_CARD_ID, text: card.more ? BRANCH_ASK_MORE : BRANCH_ASK,
    options: card.options.map((o) => ({ id: o.id, label: OPTION_LABEL[o.id] ?? o.text })), fixed: [],
  };
}

export function branchCardState(card: EngineBranchCard, at = new Date().toISOString()): BranchCardState {
  return { intent_id: card.intent_id, shown: card.options.map((o) => o.id), more: card.more, answered: false, at };
}

// 누른 보기가 지금 보여 준 갈래 카드의 보기인지(요청 값을 믿지 않음 — 엔진 requireShown과 같은 원칙).
export function branchPickAllowed(state: BranchCardState | null | undefined, option: string): boolean {
  return !!state && !state.answered && state.shown.includes(option);
}

// 갈래를 고른 뒤 과제로 바로 갈 때 고민 상태 키(concern_id) — 카드 장면이 있으면 장면, 없으면 장면 후보, 그것도 없으면 세부 고민 코드.
export function concernKeyFor(route: { intent_id: string; scene_key?: string | null; scene_candidate?: string | null }): string {
  return route.scene_key || route.scene_candidate || route.intent_id;
}

export const BRANCH_UNKNOWN_REPLY = "괜찮아요. 이유는 이야기하다 보면 천천히 보이기도 해요. 지금 떠오르는 대로 편하게 이어서 들려주세요.";
export const BRANCH_NO_TASK_REPLY = "알려 줘서 고마워요. 그 마음을 조금 더 들려주시면 함께 살펴볼게요.";
