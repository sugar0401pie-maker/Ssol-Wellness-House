import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SafetyRule } from "@/lib/safety/rules";
import type { RouteId } from "@/lib/safety/types";
import { retrieveKnowledgeChunks, findFrameworkHint } from "@/lib/rag/retrieve";
import { searchServiceKnowledge } from "@/lib/rag/serviceSearch";
import { getSystemPromptSections } from "@/lib/rag/systemPrompt";
import { buildSystemPrompt, type PersonaHint } from "@/lib/rag/prompt.ts";
import { generateReply } from "@/lib/ai/chatModel";
import { checkOutput } from "@/lib/safety/outputCheck";

// 출력 검사를 두 번 다 통과하지 못했을 때만 쓰는 마지막 안전망. 이 문장 자체는 규칙을 어길 수
// 없도록 고정 문구로 두었다 (진단·약물 지시·효과 보장이 전혀 없음).
const SAFE_FALLBACK_REPLY =
  "지금 이 부분은 조심스럽게 정리해서 답해드리고 싶어요. 제가 직접 진단하거나 약물을 안내해 드릴 수는 없지만, 정신건강의학과 등 전문가와 상담하시면 더 정확한 도움을 받으실 수 있어요. 지금 가장 걱정되는 부분이 무엇인지 조금 더 이야기해주실 수 있을까요?";

// 사용자의 웰니스 유형(디저트 유형)을 상담 관점 힌트로 쓰기 위해 불러온다.
// 2026-09-22 결정: 기본 반영, opt-out은 나중에 설정 화면이 생기면 쓸 컬럼만 미리 준비해둠.
// 진단이나 검색 하드 필터로는 절대 쓰지 않는다 — SAFE-005.
async function loadPersonaHint(userId: string): Promise<{ label: string | null; hint: PersonaHint | null }> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("wellness_profiles")
    .select("dessert_type, persona_hint_opt_out")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile?.dessert_type || profile.persona_hint_opt_out) return { label: null, hint: null };

  const { data: tax } = await admin
    .from("taxonomy")
    .select("label_ko, description")
    .eq("type", "persona")
    .eq("code", profile.dessert_type)
    .maybeSingle();
  if (!tax) return { label: null, hint: null };

  const shortLabel = tax.label_ko.split(" · ")[0]; // "티라미수 · 설계형" → "티라미수" (chunk의 persona_tags와 형식을 맞춤)
  return { label: shortLabel, hint: { label: tax.label_ko, axis: tax.description ?? "" } };
}

export type GenerationUsage = { inputTokens: number; outputTokens: number };

export async function generateAnswer(params: {
  route: RouteId;
  matchedRuleIds: string[];
  message: string;
  recentMessages: { role: "user" | "assistant"; content: string }[];
  safetyRules: SafetyRule[];
  userId: string;
}): Promise<{
  reply: string;
  retrievedChunkIds: string[];
  frameworkId: string | null;
  usage: GenerationUsage[];
  regenerated: boolean;
}> {
  const sections = await getSystemPromptSections();
  const matchedRules = params.safetyRules
    .filter((r) => params.matchedRuleIds.includes(r.rule_id))
    .map((r) => ({ rule_id: r.rule_id, category: r.category, rule_text: r.rule_text }));

  let knowledgeChunks: Awaited<ReturnType<typeof retrieveKnowledgeChunks>> = [];
  let serviceResults: Awaited<ReturnType<typeof searchServiceKnowledge>> = [];
  let frameworkHint: Awaited<ReturnType<typeof findFrameworkHint>> = null;

  const { label: personaLabel, hint: personaHint } = await loadPersonaHint(params.userId);

  if (params.route === "service_info") {
    serviceResults = await searchServiceKnowledge(params.message);
  } else {
    const scope = params.route === "clinical_diagnosis" || params.route === "clinical_distress" ? "clinical" : "general";
    knowledgeChunks = await retrieveKnowledgeChunks(
      params.message,
      params.recentMessages,
      scope,
      params.safetyRules,
      personaLabel,
    );
    if (params.route === "life_decision" && knowledgeChunks.length) {
      frameworkHint = await findFrameworkHint(knowledgeChunks.map((c) => c.article_id));
    }
  }

  // 사용자가 "이 대화를 기억하기"를 선택한 이전 세션이 있을 때만 존재한다. 참고용일 뿐,
  // 검색이나 안전 판단에는 쓰지 않는다.
  const { data: memoryRow } = await createAdminClient()
    .from("user_memory")
    .select("summary")
    .eq("user_id", params.userId)
    .maybeSingle();

  const usedClinicalChunk = knowledgeChunks.some((c) => c.clinical_sensitive);
  const system = buildSystemPrompt({
    sections,
    matchedRules,
    route: params.route,
    usedClinicalChunk,
    knowledgeChunks: knowledgeChunks.length ? knowledgeChunks : undefined,
    serviceResults: serviceResults.length ? serviceResults : undefined,
    frameworkHint,
    userMemory: memoryRow?.summary,
    personaHint,
  });

  const conversation = [...params.recentMessages, { role: "user" as const, content: params.message }];
  const usage: GenerationUsage[] = [];
  let reply: string;
  let regenerated = false;

  try {
    const first = await generateReply(system, conversation);
    usage.push({ inputTokens: first.usage.inputTokens, outputTokens: first.usage.outputTokens });
    const check1 = checkOutput(first.text, { usedClinicalChunk });

    if (check1.ok) {
      reply = first.text;
    } else {
      regenerated = true;
      const retrySystem = `${system}\n\n[내부 검수 실패 — 다시 작성] 방금 만든 답변이 아래 규칙을 어겼습니다. 같은 실수를 반복하지 말고 다시 작성하세요:\n${check1.violations.map((v) => `- ${v}`).join("\n")}`;
      const second = await generateReply(retrySystem, conversation);
      usage.push({ inputTokens: second.usage.inputTokens, outputTokens: second.usage.outputTokens });
      const check2 = checkOutput(second.text, { usedClinicalChunk });
      reply = check2.ok ? second.text : SAFE_FALLBACK_REPLY;
      if (!check2.ok) {
        console.warn("출력 검사 2회 연속 실패, 안전한 대체 문구 사용:", check2.violations);
      }
    }
  } catch (e) {
    console.error("답변 생성 실패:", e instanceof Error ? e.message : e);
    reply = SAFE_FALLBACK_REPLY;
  }

  return {
    reply,
    retrievedChunkIds: knowledgeChunks.map((c) => c.chunk_id),
    frameworkId: frameworkHint?.framework_id ?? null,
    usage,
    regenerated,
  };
}
