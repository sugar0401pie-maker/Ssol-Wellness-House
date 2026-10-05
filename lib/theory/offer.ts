import type { Choice } from "./types.ts";
import type { RouteId } from "../safety/types.ts";
import type { DialogueState } from "./dialogueState.ts";

// 2026-10-05 owner 지정 문구 — 한 글자도 바꾸지 않는다. {닉네임}만 사용자 이름으로 바뀐다.
export const OFFER_LEAD = "지금 당장 시도해보실 수 있는 마음이 나아지는 방법을 알려드릴까요?";

export function buildOfferMessage(nickname: string | null): string {
  const name = nickname?.trim() || "회원";
  return `${OFFER_LEAD} 아니면 조금 더 웰니스 관점에서 ${name}님의 고민에 대해 깊게 알아보시겠어요?`;
}

export const OFFER_CHOICES: readonly Choice[] = [
  { id: "action", label: "행동 제안받기" },
  { id: "explore", label: "내 고민 더 알아보기" },
];

// 대화 기록을 다시 불러왔을 때(서버는 role/content만 돌려준다) 이 메시지가 선택 안내인지 알아보는 용도.
export function isOfferMessage(text: string): boolean {
  return text.startsWith(OFFER_LEAD);
}

// owner 요청: "사용자가 2~3번 정도 질문했을 때" 한 번만 제안한다.
export const OFFER_MIN_USER_TURN = 2;
export const OFFER_MAX_USER_TURN = 3;

// 이 기능이 켜질 수 있는 route. 임상(진단/우울·공황·트라우마)·위기·폭력·서비스 문의에서는 절대 열지 않는다.
export const DIALOGUE_ALLOWED_ROUTES: readonly RouteId[] = ["wellness", "life_decision"];

export function isDialogueRouteAllowed(route: RouteId): boolean {
  return DIALOGUE_ALLOWED_ROUTES.includes(route);
}

// 제안을 해도 되는 상황인지. 후보(이론 매칭)가 있는지는 비용이 드는 검색이 필요해서 호출하는 쪽이
// 이 함수(싼 조건)를 먼저 통과시킨 뒤에만 검색한다.
export function canOfferNow(p: {
  enabled: boolean;
  route: RouteId;
  isPersonaQuestion: boolean;
  userTurn: number; // 이번 메시지를 포함한 이 세션의 사용자 메시지 번호(1부터)
  state: DialogueState;
}): boolean {
  if (!p.enabled) return false;
  if (p.isPersonaQuestion) return false;
  if (!isDialogueRouteAllowed(p.route)) return false;
  if (p.state.offered || p.state.mode !== "undecided") return false;
  return p.userTurn >= OFFER_MIN_USER_TURN && p.userTurn <= OFFER_MAX_USER_TURN;
}
