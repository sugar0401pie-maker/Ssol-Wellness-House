// 이론 기반 "행동 제안 vs 고민 더 알아보기" 선택 대화에서 서버·프롬프트·화면이 함께 쓰는 타입(2026-10-06 새 구조).
// 브라우저에서도 쓰이므로 "server-only"를 넣지 않는다.

export type TheoryStage = "OPEN" | "CLARIFY" | "REFRAME" | "COMMIT";

export const THEORY_STAGES: readonly TheoryStage[] = ["OPEN", "CLARIFY", "REFRAME", "COMMIT"];

// 이론별 "말투 카드"(문서 D6): 쏘웰라의 목소리는 그대로 두고, 탐색 단계에서만 질문 방식·어휘·받아주는 자세·금지 표현을 얹는다.
export type VoiceCard = { questionStyle: string; vocab: string; stance: string; forbidden: string };

// 프롬프트에 "이번 단계에서 쓸 DB 자료"를 넘길 때 쓰는 값. 사용자에게는 노출되지 않는다(질문 문장만 시스템이 그대로 붙인다).
export type TheoryGuide = {
  plainFocus: string; // counseling_theories.plain_focus (쉬운 한 줄 — 이론 이름 아님)
  stage: TheoryStage;
  question: string; // theory_questions.question_text (채팅용 — 시스템이 답변 끝에 그대로 붙인다)
  intent: string | null; // theory_questions.intent
  growthFrame: string | null; // 질문과 연결된 개념의 성장 프레임(REFRAME에서 한두 문장으로 풀어 잇는 재료)
  voiceCard: VoiceCard | null;
};

// 선택 칩. id는 서버가 검증하는 값이고 label은 화면에 보이는 글자다.
//  - action/explore: 선택 안내의 두 칩(owner 지정 글자)
//  - extend/finish: 탐색 마무리(COMMIT) 뒤의 연장 칩
export type ChoiceId = "action" | "explore" | "extend" | "finish";
export type Choice = { id: ChoiceId; label: string };
