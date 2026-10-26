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

// 2026-09-28 owner 요청: 시안(.chipq)처럼, 대화를 시작하기 전 첫 인사말 아래에 바로 눌러볼 수
// 있는 질문 몇 개를 칩 형태로 랜덤 노출한다(대화가 시작되면 사라짐) — 매번 다른 질문이
// 보이도록 순수 함수로 분리해 테스트 가능하게 둔다.
export function pickRandomSuggestedQuestions(count: number, groups: SuggestedQuestionGroup[] = SUGGESTED_QUESTION_GROUPS): SuggestedQuestion[] {
  const all = groups.flatMap((g) => g.questions);
  const shuffled = [...all];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

// 2026-10-22: 위 "성향 질문"은 디저트 유형 테스트 결과가 있어야 답할 수 있다. 결과가 없는 사용자(점성술 등 다른 경로로 들어온 분 포함)가 첫 화면에서 이 칩을
// 누르면 "테스트부터 하세요"라는 고정 문구를 받고 떠났다(최근 14일 8명 중 다시 온 사람 0명). 그래서 테스트 결과가 없으면 이 일상 고민 시작 문구를 대신 보여 준다.
// 일반 대화로 보내는 말이라 테스트가 필요 없다. 몇 개는 선택 카드 장면(기운 빠짐·거절·답장·일 맞음·실수·배움 시작)과 이어지는 말투다.
export const EVERYDAY_QUESTION_GROUPS: SuggestedQuestionGroup[] = [
  {
    title: "일·진로",
    questions: [
      { id: "ed-work-1", text: "요즘 일이 너무 버거워서 지쳐요" },
      { id: "ed-work-2", text: "지금 하는 일이 나랑 맞는지 모르겠어요" },
      { id: "ed-work-3", text: "일에서 성취감이 잘 느껴지지 않아요" },
    ],
  },
  {
    title: "사람·관계",
    questions: [
      { id: "ed-rel-1", text: "사람을 만나고 나면 기운이 빠져요" },
      { id: "ed-rel-2", text: "부탁을 거절하기가 너무 어려워요" },
      { id: "ed-rel-3", text: "연락이 늦으면 자꾸 신경이 쓰여요" },
    ],
  },
  {
    title: "나 자신",
    questions: [
      { id: "ed-self-1", text: "실수하면 내가 한심하게 느껴져요" },
      { id: "ed-self-2", text: "마음이 복잡한데 뭐부터 정리해야 할지 모르겠어요" },
      { id: "ed-self-3", text: "요즘 나를 돌볼 여유가 없어요" },
    ],
  },
  {
    title: "삶의 방향",
    questions: [
      { id: "ed-dir-1", text: "배우고 싶은 게 있는데 시작이 안 돼요" },
      { id: "ed-dir-2", text: "앞으로 어떻게 살아야 할지 막막해요" },
      { id: "ed-dir-3", text: "내가 뭘 원하는지 잘 모르겠어요" },
    ],
  },
];
