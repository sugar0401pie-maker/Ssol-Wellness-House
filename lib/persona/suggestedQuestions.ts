// "성향 질문" 칩에 쓰는 목록. 웰니스 유형(디저트 유형) 테스트 결과를 바탕으로 자기이해를 돕는
// 질문들이며, 사주 앱 형식에서 착안했다. 향·장소·운세·확률처럼 심리 테스트로 옮길 근거가 없는
// 오락성 질문은 제외했다 (2026-09-22 결정, CLAUDE.md 참고).
// 브라우저에서도 쓰이므로 "server-only"를 임포트하지 않는다.
export type SuggestedQuestion = { id: string; text: string };
export type SuggestedQuestionGroup = { title: string; questions: SuggestedQuestion[] };

export const SUGGESTED_QUESTION_GROUPS: SuggestedQuestionGroup[] = [
  {
    title: "정체성·성향",
    questions: [
      { id: "identity-1", text: "다른 사람은 나를 어떻게 볼까, 내가 보는 나와 얼마나 다를까?" },
      { id: "identity-2", text: "내가 가장 나답다고 느끼는 순간은 언제일까?" },
      { id: "identity-3", text: "나의 고유한 강점은 무엇일까?" },
    ],
  },
  {
    title: "가치관",
    questions: [
      { id: "values-1", text: "내가 중요하게 여기는 가치는 무엇일까?" },
      { id: "values-2", text: "내 선택의 기준은 보통 무엇일까?" },
    ],
  },
  {
    title: "관계 패턴",
    questions: [
      { id: "relation-1", text: "나는 갈등 상황에서 보통 어떻게 반응할까?" },
      { id: "relation-2", text: "내가 관계에서 반복하는 패턴이 있을까?" },
      { id: "relation-3", text: "나와 비슷한 방식으로 대처하는 사람, 나와 다르게 대처하는 사람은 각각 어떤 느낌일까?" },
    ],
  },
  {
    title: "무의식적 경향·취약점",
    questions: [
      { id: "unconscious-1", text: "내가 스트레스 받을 때 무의식중에 하는 행동은?" },
      { id: "unconscious-2", text: "내가 가장 취약해지는 상황은 언제일까?" },
      { id: "unconscious-3", text: "회피와 직면 중 나는 어느 쪽에 더 가까울까?" },
    ],
  },
  {
    title: "성장 영역",
    questions: [
      { id: "growth-1", text: "지금 내 삶에서 가장 채워야 할 부분은 무엇일까?" },
      { id: "growth-2", text: "내가 과하게 쓰고 있는 에너지는 무엇일까?" },
    ],
  },
  {
    title: "일·진로 스타일",
    questions: [
      { id: "work-1", text: "나에게 잘 맞는 업무 방식은?" },
      { id: "work-2", text: "내가 일할 때 놓치기 쉬운 부분은?" },
    ],
  },
];
