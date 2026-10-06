// 한 대화(세션)에서 나눌 수 있는 사용자 메시지 수 상한. 순수 값·함수라 네트워크 없이 테스트할 수 있다.
//
// 2026-10-06 owner 결정: 사용자 메시지 기준 20개가 상한이고, 도달하면 "원활한 대화를 위해 새로운
// 대화로 다시 시작해보세요" 안내 팝업을 띄운다. 답변 생성에는 최근 10개 메시지만 들어가므로(route.ts)
// 대화가 아주 길어지면 AI가 앞부분을 못 보게 되어, 새 대화로 시작하는 편이 더 낫다.
//
// 위기(crisis)·폭력(violence) 응답은 이 상한과 무관하게 항상 동작해야 한다 — 실제 적용은
// app/api/chat/route.ts에서 그 두 route와 분류기 장애 응답을 이 검사보다 먼저 처리해서 보장하고,
// 상한을 셀 때도 그 두 route의 메시지는 세지 않는다(하루 한도와 같은 방식).
export const SESSION_USER_MESSAGE_LIMIT = Number(process.env.SESSION_USER_MESSAGE_LIMIT || 20);

// 답변 생성·안전 분류 문맥으로 쓰는 "최근 대화" 메시지 수(사용자+AI 합쳐서). 2026-10-06 owner 결정으로
// 10 -> 20개로 늘렸다(대화당 사용자 메시지 상한 20개 = 전체 약 40개 중 최근 20개를 AI가 본다).
// 늘리면 긴 대화에서 메시지당 입력이 약 1,000토큰(약 0.3원) 더 든다. 안전 분류기·실천 검색은 이 중
// 최근 4개만 쓰므로 영향이 없다.
export const HISTORY_MESSAGE_LIMIT = 20;

// 상한을 넘긴 메시지에 대해 AI 호출 없이(비용 없음) 돌려주는 고정 안내. "~할 수 없어요" 같은 거절형이
// 아니라 제안형으로 쓴다(2026-09-22 ground rule).
export const SESSION_LIMIT_REPLY =
  "이번 대화에서 나눌 수 있는 메시지를 모두 사용했어요. 원활한 대화를 위해 새로운 대화로 다시 시작해보세요.";

// userMessageCount: 이번 메시지까지 포함해, 이 세션의 사용자 메시지 수(위기·폭력 제외).
// reached: 이번 메시지가 마지막으로 허용되는 메시지거나 이미 넘은 상태 → 팝업을 띄울 때.
// blocked: 이번 메시지는 상한을 넘었으므로 답변을 만들지 않는다.
export function sessionLimitState(userMessageCount: number, limit: number = SESSION_USER_MESSAGE_LIMIT) {
  return { reached: userMessageCount >= limit, blocked: userMessageCount > limit };
}
