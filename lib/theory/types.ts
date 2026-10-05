// 2026-10-05: 이론 기반 "행동 제안 vs 고민 더 알아보기" 선택 대화(준비 단계, THEORY_OFFER_ENABLED가
// 꺼져 있으면 아무 동작도 하지 않는다)에서 서버·프롬프트·화면이 함께 쓰는 타입. 브라우저에서도
// 쓰이므로 "server-only"를 넣지 않는다.

export type TheoryStage = "OPEN" | "CLARIFY" | "REFRAME" | "COMMIT";

export const THEORY_STAGES: readonly TheoryStage[] = ["OPEN", "CLARIFY", "REFRAME", "COMMIT"];

// 프롬프트에 "이번 단계의 질문 하나"를 넘길 때 쓰는 값. 사용자에게는 노출되지 않는다.
export type TheoryGuide = {
  plainFocus: string; // counseling_theories.plain_focus (쉬운 한 줄 — 이론 이름 아님)
  stage: TheoryStage;
  question: string; // theory_questions.question_text
  intent: string | null; // theory_questions.intent
};

// 선택 칩. id는 서버가 검증하는 값이고 label은 화면에 보이는 글자다.
export type ChoiceId = "action" | "explore";
export type Choice = { id: ChoiceId; label: string };
