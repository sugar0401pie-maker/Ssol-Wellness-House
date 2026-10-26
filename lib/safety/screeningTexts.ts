import { FIXED_RESPONSES } from "./crisisResponses.ts";
import type { ScreenKind } from "./screening.ts";

// 스크리닝 질문·안내 고정 문구 (2026-10-23, docs/안전설계_스크리닝흐름_v0.3.md).
// ⚠ 개발 초안입니다 — 상담사님 검토 전이라 기능 스위치(SW_SCREENING_ENABLED)는 기본 꺼짐입니다. 확정되면 이 파일만 고칩니다.
// 원칙: 제안형·존댓말, "~할 수 없어요" 금지, 진단·낙인 표현 금지, AI가 쓰지 않는다(고정 문구).
// 번호(109, 1577-0199, 112, 119, 1366)는 crisisResponses.ts에서 이미 승인된 값만 쓴다.

const SUICIDE_HELP = "109(자살예방 상담전화), 1577-0199(정신건강 상담전화)";
const VIOLENCE_HELP = "112(경찰), 여성긴급전화 1366(24시간)";

export const SCREEN_QUESTION: Record<ScreenKind, string> = {
  suicide: "이야기해주셔서 고마워요. 죽음과 관련된 이야기라서, 이어가기 전에 하나만 여쭤볼게요. 요즘 자살이나 자해에 대한 생각을 한 적 있나요?",
  violence: "말씀해주신 상황이 마음에 걸려요. 혹시 지금 정서적 학대나 폭력으로 안전이 위협받고 있다고 느끼시나요?",
};

// 답이 "아니요/없어요"일 때(일반 안내). 자살 쪽은 죽음을 직접 상상하는 활동의 대안을 제안하고, 주의 표시(watch)가 함께 붙는다.
export const SCREEN_OK: Record<ScreenKind, string> = {
  suicide:
    "말씀해주셔서 고마워요. 죽음을 직접 상상해보는 활동은 진행자와 함께하는 자리에서 하는 게 더 안전해요. 여기서는 먼 훗날 인생을 돌아보는 자리에서 어떤 사람으로 기억되고 싶은지 함께 적어보는 건 어떨까요? " +
    `마음이 무거워지면 언제든 ${SUICIDE_HELP}로 24시간 연락해보실 수 있어요.`,
  violence: "말씀해주셔서 고마워요. 지금은 안전하시다니 다행이에요. 그래도 마음이 힘들거나 상황이 달라지면 언제든 편하게 이야기를 이어가 주세요.",
};

// 답이 애매할 때(글쎄요·모르겠어요·길거나 다른 이야기): 중단하지 않고 안내 문구 + 주의 표시(watch).
export const SCREEN_UNCLEAR: Record<ScreenKind, string> = {
  suicide: `대답하기 어려운 질문이었을 수 있어요. 혹시 마음이 많이 힘든 상태라면 ${SUICIDE_HELP}로 24시간 이야기 나눠보실 수 있어요. 이야기를 이어가고 싶으시면 편하게 들려주세요.`,
  violence: `대답하기 어려운 질문이었을 수 있어요. 안전이 걱정되는 상황이라면 ${VIOLENCE_HELP}에서 도움받으실 수 있어요. 이야기를 이어가고 싶으시면 편하게 들려주세요.`,
};

// 답이 "있어요/네"일 때: 이미 승인된 고정 응답을 그대로 쓰고, 폭력에는 챗봇 용도 재명시 한 줄을 더한다. 이후 이 대화는 새 대화를 시작하기 전까지 중단 안내만 한다(Q3).
export const SCREEN_RISK: Record<ScreenKind, string> = {
  suicide: FIXED_RESPONSES.crisis!,
  violence: `${FIXED_RESPONSES.violence!}\n\n이 대화는 전문가의 도움을 대신하지 않아요. 안전은 위의 전문기관과 함께 확인해보세요.`,
};

// 중단된 대화에서 이어지는 메시지마다 보내는 짧은 안내.
export const SCREEN_STOP_REPEAT: Record<ScreenKind, string> = {
  suicide: `지금은 안전이 가장 중요해요. 위험이 임박했다면 119(응급)로 바로 연락해주세요. ${SUICIDE_HELP}에서는 24시간 전문가와 이야기할 수 있어요. 새 대화를 시작하시면 다시 이야기를 나눌 수 있어요.`,
  violence: `지금은 안전이 가장 중요해요. 위험이 임박했다면 ${VIOLENCE_HELP}로 바로 연락해주세요. 새 대화를 시작하시면 다시 이야기를 나눌 수 있어요.`,
};

// S5(점수·진단·원인 확정 요청, 상담사님 R1)의 두 번째 요청에 대한 고정 안내. 같은 요청을 한 번 더 했을 때만 나간다(Q7: 같은 대화 안). 제안형 — 단정하기 어렵다는 말을 "~어려워요"로 쓰되 대안을 함께 제안한다.
// "단정"과 "개인 웰니스 세션" 두 낱말은 이 안내가 이미 나갔는지 알아보는 표시로 쓰이므로(lib/safety/situations.ts) 문구를 고칠 때 함께 유지한다.
export const VERDICT_SECOND_REPLY =
  "점수나 원인을 한 번에 단정하기는 쉽지 않아요. 대신 지금 마음을 더 깊이 살펴보고 싶으시다면, 개인 웰니스 세션에서 상담사와 함께 이야기 나눠보는 건 어떨까요? 여기서는 지금 가장 마음에 걸리는 부분부터 천천히 이어가도 좋아요.";
