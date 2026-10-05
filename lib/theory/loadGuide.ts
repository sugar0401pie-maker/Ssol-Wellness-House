import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { THEORY_STAGES, type TheoryGuide, type TheoryStage } from "./types";
import type { DialogueState } from "./dialogueState";

type QuestionRow = {
  question_id: string;
  stage: TheoryStage;
  order_in_stage: number;
  question_text: string;
  intent: string | null;
};

export type LoadedGuide = {
  guide: TheoryGuide | null; // null이면 이론 질문을 못 찾은 것 — 호출하는 쪽이 일반 탐색 지시로 대체한다
  questionId: string | null;
  stage: TheoryStage;
  maxTurns: number;
};

const DEFAULT_MAX_TURNS = 4;

// explore의 이번 턴에 쓸 질문 하나를 고른다. 현재 단계에서 아직 안 쓴 승인 질문을 우선(제안 시점에 매칭된
// 질문이 있으면 그것부터), 없으면 다음 단계로 넘어가며 찾는다. 어떤 실패도 guide=null로 처리한다.
export async function loadTheoryGuide(
  admin: ReturnType<typeof createAdminClient>,
  state: DialogueState,
): Promise<LoadedGuide> {
  const fallback: LoadedGuide = { guide: null, questionId: null, stage: state.stage, maxTurns: DEFAULT_MAX_TURNS };
  if (!state.theoryId) return fallback;

  try {
    const [{ data: theory, error: theoryError }, { data: questions, error: questionsError }] = await Promise.all([
      admin
        .from("counseling_theories")
        .select("plain_focus, max_explore_turns")
        .eq("theory_id", state.theoryId)
        .eq("review_status", "APPROVED")
        .maybeSingle(),
      admin
        .from("theory_questions")
        .select("question_id, stage, order_in_stage, question_text, intent")
        .eq("theory_id", state.theoryId)
        .eq("review_status", "APPROVED")
        .order("order_in_stage"),
    ]);
    if (theoryError || questionsError || !theory || !questions) return fallback;

    const maxTurns = typeof theory.max_explore_turns === "number" ? theory.max_explore_turns : DEFAULT_MAX_TURNS;
    const unasked = (questions as QuestionRow[]).filter((q) => !state.askedQuestionIds.includes(q.question_id));

    for (let i = THEORY_STAGES.indexOf(state.stage); i >= 0 && i < THEORY_STAGES.length; i++) {
      const stage = THEORY_STAGES[i];
      const inStage = unasked.filter((q) => q.stage === stage);
      if (!inStage.length) continue;
      const preferred = inStage.find((q) => state.candidateQuestionIds.includes(q.question_id)) ?? inStage[0];
      return {
        guide: { plainFocus: theory.plain_focus, stage, question: preferred.question_text, intent: preferred.intent },
        questionId: preferred.question_id,
        stage,
        maxTurns,
      };
    }
    return { ...fallback, maxTurns };
  } catch (e) {
    console.warn("이론 질문 불러오기 실패, 일반 탐색으로 대체:", e instanceof Error ? e.message : e);
    return fallback;
  }
}
