import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { TRAUMA_EXCLUDED_TECHNIQUE_NUMBERS, type TraumaStage } from "@/lib/safety/traumaStage";
import { DEFAULT_MAX_EXPLORE_TURNS } from "./dialogueState";
import { THEORY_STAGES, type TheoryGuide, type TheoryStage, type VoiceCard } from "./types";

type QuestionRow = {
  question_id: string;
  stage: TheoryStage;
  order_in_stage: number;
  question_text: string;
  intent: string | null;
  concept_id: string | null;
  technique_id: string | null;
};

export type LoadedGuide = {
  guide: TheoryGuide | null; // null이면 이 이론에서 쓸 질문을 못 찾은 것 — 호출하는 쪽이 중립 질문·일반 탐색으로 대체한다
  questionId: string | null;
  stage: TheoryStage; // 실제로 질문을 찾은 단계(요청한 단계에 질문이 없으면 다음 단계로 넘어간 값)
  maxTurns: number;
  theoryFocus: string | null;
  voiceCard: VoiceCard | null;
};

// 탐색의 이번 턴에 쓸 질문 하나를 고른다. 요청한 단계에서 아직 안 쓴 "검수 완료 + 챗봇 사용 가능" 질문을 우선하고,
// 그 단계에 질문이 없으면 다음 단계로 넘어가며 찾는다. 트라우마 일상어(T0)에서는 제외 기법의 질문을 빼고 고른다.
// 어떤 실패(테이블 없음 등)도 guide=null로 처리한다.
export async function loadTheoryGuide(
  admin: ReturnType<typeof createAdminClient>,
  params: { theoryId: string; stage: TheoryStage; askedQuestionIds: string[]; traumaStage: TraumaStage | null },
): Promise<LoadedGuide> {
  const fallback: LoadedGuide = { guide: null, questionId: null, stage: params.stage, maxTurns: DEFAULT_MAX_EXPLORE_TURNS, theoryFocus: null, voiceCard: null };
  try {
    const [{ data: theory, error: te }, { data: questions, error: qe }, { data: techniques }] = await Promise.all([
      admin.from("counseling_theories").select("plain_focus, max_explore_turns, voice_card").eq("theory_id", params.theoryId).eq("review_status", "APPROVED").maybeSingle(),
      admin
        .from("theory_questions")
        .select("question_id, stage, order_in_stage, question_text, intent, concept_id, technique_id")
        .eq("theory_id", params.theoryId)
        .eq("review_status", "APPROVED")
        .eq("chat_enabled", true)
        .order("order_in_stage")
        .order("question_id"),
      admin.from("theory_techniques").select("technique_id, number").eq("theory_id", params.theoryId),
    ]);
    if (te || qe || !theory || !questions) return fallback;

    const raw = (theory.voice_card ?? null) as { question_style?: string; vocab?: string; stance?: string; forbidden?: string } | null;
    const voiceCard: VoiceCard | null = raw ? { questionStyle: raw.question_style ?? "", vocab: raw.vocab ?? "", stance: raw.stance ?? "", forbidden: raw.forbidden ?? "" } : null;
    const maxTurns = typeof theory.max_explore_turns === "number" ? theory.max_explore_turns : DEFAULT_MAX_EXPLORE_TURNS;
    const base = { ...fallback, maxTurns, theoryFocus: theory.plain_focus as string, voiceCard };

    const excludedNumbers = params.traumaStage === "T0" ? TRAUMA_EXCLUDED_TECHNIQUE_NUMBERS[params.theoryId] ?? [] : [];
    const excludedTechniqueIds = new Set(
      ((techniques ?? []) as { technique_id: string; number: string | null }[]).filter((t) => t.number && excludedNumbers.includes(t.number)).map((t) => t.technique_id),
    );
    const usable = (questions as QuestionRow[]).filter(
      (q) => !params.askedQuestionIds.includes(q.question_id) && !(q.technique_id && excludedTechniqueIds.has(q.technique_id)),
    );

    for (let i = THEORY_STAGES.indexOf(params.stage); i >= 0 && i < THEORY_STAGES.length; i++) {
      const stage = THEORY_STAGES[i];
      const inStage = usable.filter((q) => q.stage === stage);
      if (!inStage.length) continue;
      const picked = inStage[0];
      let growthFrame: string | null = null;
      if (picked.concept_id) {
        const { data: concept } = await admin.from("theory_concepts").select("growth_frame").eq("concept_id", picked.concept_id).maybeSingle();
        growthFrame = (concept?.growth_frame as string | null) || null;
      }
      return {
        ...base,
        guide: { plainFocus: theory.plain_focus as string, stage, question: picked.question_text, intent: picked.intent, growthFrame, voiceCard },
        questionId: picked.question_id,
        stage,
      };
    }
    return base;
  } catch (e) {
    console.warn("이론 질문 불러오기 실패, 이론 없이 일반 탐색으로 대체:", e instanceof Error ? e.message : e);
    return fallback;
  }
}
