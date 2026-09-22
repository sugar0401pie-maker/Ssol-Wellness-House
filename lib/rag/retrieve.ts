import "server-only";
import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { findKeywordHits } from "@/lib/safety/keywordCheck.ts";
import type { SafetyRule } from "@/lib/safety/rules.ts";
import type { RouteId } from "@/lib/safety/types.ts";

const EMBEDDING_MODEL = "text-embedding-3-small"; // knowledge_chunks.embedding과 같은 모델·차원(1536)이어야 함

export type RetrievedChunk = {
  chunk_id: string;
  article_id: string;
  chunk_title: string | null;
  chunk_text: string;
  domain_tags: string[] | null;
  issue_tags: string[] | null;
  wellness_theme: string[] | null;
  persona_tags: string[] | null;
  use_when: string | null;
  follow_up_prompt: string | null;
  evidence_level: string;
  ai_attribution_rule: string | null;
  do_not: string | null;
  do_not_apply_when: string[] | null;
  clinical_sensitive: boolean;
  similarity: number;
};

// do_not_apply_when은 "학대/위협", "중등도 이상 우울" 같은 서술형 문구라서, 정해진 키워드 목록이
// 아니다. 대신 이미 만들어 둔 안전 키워드 범주(crisis/violence/clinical_*)로 분류해서, 최근 대화에
// 그 범주의 신호가 있으면 해당 chunk를 검색 결과에서 제외한다. (예: 앞선 대화에서 폭력이 언급됐다면,
// 지금 다른 질문을 해도 "다툼은 자연스럽다" 류의 chunk는 계속 제외되어야 한다.)
function categoryOf(value: string): RouteId | null {
  if (/폭력|강요|스토킹|협박|위협|학대|권력불균형|모욕|공동 대화/.test(value)) return "violence";
  if (/자살|자해|공격성|위험행동/.test(value)) return "crisis";
  if (/공황|트라우마|해리|우울|기능저하|흉통|호흡곤란/.test(value)) return "clinical_distress";
  if (/진단|약물|ADHD|변경|중단/.test(value)) return "clinical_diagnosis";
  return null;
}

function shouldExclude(chunk: { do_not_apply_when: string[] | null }, activeCategories: Set<RouteId>): boolean {
  if (!chunk.do_not_apply_when?.length) return false;
  return chunk.do_not_apply_when.some((v) => {
    const cat = categoryOf(v);
    return cat !== null && activeCategories.has(cat);
  });
}

// 검색 결과 순위를 태그 일치로 아주 가볍게 조정한다. 벡터 유사도가 주된 신호이고, 이건 보조일 뿐이다.
// (2026-09-22 결정: 별도 분류기 호출 없이 가볍게. domain_tags/issue_tags/wellness_theme만 본다.)
function tagBonus(chunk: RetrievedChunk, conversationText: string): number {
  const tags = [...(chunk.domain_tags ?? []), ...(chunk.issue_tags ?? []), ...(chunk.wellness_theme ?? [])];
  if (!tags.length) return 0;
  const lower = conversationText.toLowerCase();
  const hits = tags.filter((t) => t && lower.includes(t.toLowerCase())).length;
  return Math.min(hits, 3) * 0.02; // 태그 하나당 아주 작은 가산점, 최대 0.06
}

// 사용자의 웰니스 유형(디저트 유형)과 chunk의 persona_tags가 겹치면 상담 관점으로 조금 더
// 끌어올린다. 단어 우연히 겹친 것보다 뚜렷한 신호라 tagBonus보다 조금 더 크게 준다.
// (2026-09-22 결정: 상담 관점·프레임워크에 반영. 검색 하드 필터로는 절대 쓰지 않음 — SAFE-005.)
function personaBonus(chunk: RetrievedChunk, personaLabel: string | null): number {
  if (!personaLabel) return 0;
  return (chunk.persona_tags ?? []).includes(personaLabel) ? 0.05 : 0;
}

/**
 * knowledge_chunks에서 관련 chunk를 찾는다.
 *  - 일반(scope="general") 웰니스/인생결정 route: 최종 5개
 *  - 임상(scope="clinical") route: 최종 3개, clinical_sensitive chunk만
 *  - do_not_apply_when에 해당하는 위험 신호가 최근 대화에 있으면 그 chunk는 제외
 *  - domain/issue/theme 태그가 최근 대화와 겹치면 아주 약하게 순위를 올림 (하드 필터 아님)
 *  - 디저트 유형(personaLabel)이 있으면 persona_tags가 겹치는 chunk를 살짝 더 끌어올림
 *    (상담 관점 참고용. 검색을 걸러내는 하드 필터로는 절대 쓰지 않는다 — SAFE-005)
 */
export async function retrieveKnowledgeChunks(
  message: string,
  recentMessages: { role: "user" | "assistant"; content: string }[],
  scope: "general" | "clinical",
  safetyRules: SafetyRule[],
  personaLabel: string | null = null,
): Promise<RetrievedChunk[]> {
  const admin = createAdminClient();
  const openai = new OpenAI();

  const finalCount = scope === "clinical" ? 3 : 5;
  const candidatePoolSize = finalCount * 2; // rerank가 의미 있으려면 필요한 것보다 조금 더 뽑아둔다

  const embedding = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: message,
    encoding_format: "float",
  });

  const { data, error } = await admin.rpc("match_knowledge_chunks", {
    query_embedding: embedding.data[0].embedding,
    match_count: candidatePoolSize,
    min_similarity: 0.15, // 매우 낮은 문턱. 여기서 많이 거르지 않고, 무관한 질문은 프롬프트 지시로 처리
    scope,
  });
  if (error) {
    console.error("knowledge_chunks 검색 실패:", error.message);
    return [];
  }
  const candidates = (data ?? []) as RetrievedChunk[];

  const conversationText = [...recentMessages.map((m) => m.content), message].join("\n");
  const activeCategories = new Set(
    findKeywordHits(conversationText, safetyRules)
      .map((h) => h.route)
      .filter((r): r is RouteId => r === "crisis" || r === "violence" || r === "clinical_diagnosis" || r === "clinical_distress"),
  );

  return candidates
    .filter((c) => !shouldExclude(c, activeCategories))
    .map((c) => ({
      ...c,
      similarity: c.similarity + tagBonus(c, conversationText) + personaBonus(c, personaLabel),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, finalCount);
}

export type FrameworkHint = { framework_id: string; framework_name: string; steps: string[] };

// route 5(인생 결정)에서, 검색된 chunk의 글(article)에 연결된 프레임워크가 있으면 함께 안내한다.
// frameworks는 11행뿐이라 별도 검색 없이 전체를 훑는다.
export async function findFrameworkHint(articleIds: string[]): Promise<FrameworkHint | null> {
  if (!articleIds.length) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("frameworks").select("framework_id,framework_name,steps,linked_article_ids");
  const match = (data ?? []).find((f) => (f.linked_article_ids ?? []).some((a: string) => articleIds.includes(a)));
  if (!match) return null;
  const steps = Array.isArray(match.steps) ? match.steps.map((s: unknown) => String(s)) : [];
  return { framework_id: match.framework_id, framework_name: match.framework_name, steps };
}
