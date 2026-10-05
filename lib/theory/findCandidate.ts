import "server-only";
import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { findKeywordHits } from "@/lib/safety/keywordCheck";
import type { SafetyRule } from "@/lib/safety/rules";
import type { RouteId } from "@/lib/safety/types";
import { EMBEDDING_MODEL, shouldExclude } from "@/lib/rag/retrieve";
import { pickTheoryCandidate, type MatcherConfig, type TheoryCandidate } from "./matcher";

type TheoryQuestionRow = {
  question_id: string;
  theory_id: string;
  do_not_apply_when: string[] | null;
  similarity: number;
};

// 최근 사용자 발화 2~3개를 이어 붙여 임베딩하고, 승인된 이론 질문 중 비슷한 것을 찾아 가장 가까운
// 이론 하나를 돌려준다. 어떤 실패(테이블/함수 없음 = 마이그레이션 전, OpenAI 장애 등)도 null로
// 처리한다 — "후보 없음"은 평소 대화 그대로 진행한다는 뜻이라 가장 안전한 쪽이다.
export async function findTheoryCandidate(params: {
  userMessages: string[]; // 오래된 순, 이번 메시지가 마지막
  route: RouteId;
  safetyRules: SafetyRule[];
  matcher: MatcherConfig;
}): Promise<TheoryCandidate | null> {
  const recent = params.userMessages.slice(-3);
  const text = recent.join("\n").trim();
  if (!text) return null;

  try {
    const openai = new OpenAI();
    const embedding = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      encoding_format: "float",
    });

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("match_theory_questions", {
      query_embedding: embedding.data[0].embedding,
      match_count: 12,
      min_similarity: 0.15,
      current_route: params.route,
      include_sensitive: false,
    });
    if (error) {
      // 마이그레이션(20261005000000)을 아직 실행하지 않았다면 여기로 온다 — 정상적인 준비 상태.
      console.warn("match_theory_questions 호출 실패(마이그레이션 전일 수 있음):", error.message);
      return null;
    }

    // 최근 대화에 위기·폭력·임상 키워드 신호가 있으면 해당 질문은 제외한다(지식 검색과 같은 규칙).
    const activeCategories = new Set(
      findKeywordHits(text, params.safetyRules)
        .map((h) => h.route)
        .filter(
          (r): r is RouteId => r === "crisis" || r === "violence" || r === "clinical_diagnosis" || r === "clinical_distress",
        ),
    );

    const rows = ((data ?? []) as TheoryQuestionRow[]).filter((r) => !shouldExclude(r, activeCategories));
    return pickTheoryCandidate(
      rows.map((r) => ({ questionId: r.question_id, theoryId: r.theory_id, similarity: r.similarity })),
      params.matcher,
    );
  } catch (e) {
    console.warn("이론 후보 검색 실패, 후보 없음으로 처리:", e instanceof Error ? e.message : e);
    return null;
  }
}
