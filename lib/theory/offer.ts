import type { Choice } from "./types.ts";

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

// 탐색 마무리(COMMIT) 뒤 연장 칩(문서 4-2 ②-2). 문구는 Claude 초안 — owner가 바꿀 수 있다.
export const EXTENSION_LEAD = "여기까지 어떠셨어요? 이 중에서 해보고 싶은 게 있으면 그걸로 시작해보시고, 조금 더 이야기하고 싶으시면 말씀해 주세요.";
export const EXTENSION_CHOICES: readonly Choice[] = [
  { id: "finish", label: "이걸로 해볼게요" },
  { id: "extend", label: "조금 더 이야기할래요" },
];

// 칩을 안 누르고 말을 이어가서 탐색을 시작할 때 답변 앞에 붙이는 한 줄(문서 D1). 문구는 Claude 초안.
export const IMPLICIT_EXPLORE_NOTICE = "그럼 조금 더 함께 들여다볼게요. 바로 해볼 수 있는 방법이 궁금해지면 언제든 말씀해 주세요.";

// 이론 없이 일반 탐색을 하다가 이론을 아직 못 정했을 때 쓰는 중립 첫 질문(문서 D2: "조금 더 이야기해줄래요?").
export const NEUTRAL_OPEN_QUESTION = "요즘 이 일이 어떻게 이어지고 있는지, 조금 더 이야기해줄래요?";

// 대화 기록을 다시 불러왔을 때(서버는 role/content만 돌려준다) 이 메시지가 어떤 안내인지 알아보는 용도.
export function isOfferMessage(text: string): boolean {
  return text.startsWith(OFFER_LEAD);
}
export function isExtensionMessage(text: string): boolean {
  return text.startsWith(EXTENSION_LEAD);
}
export function choicesForMessage(text: string): readonly Choice[] | null {
  if (isOfferMessage(text)) return OFFER_CHOICES;
  if (isExtensionMessage(text)) return EXTENSION_CHOICES;
  return null;
}
