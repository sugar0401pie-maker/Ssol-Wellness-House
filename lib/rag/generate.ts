import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SafetyRule } from "@/lib/safety/rules";
import type { RouteId } from "@/lib/safety/types";
import { retrieveKnowledgeChunks, findFrameworkHint } from "@/lib/rag/retrieve";
import { searchServiceKnowledge } from "@/lib/rag/serviceSearch";
import { searchWellnessPractices } from "@/lib/rag/practicesSearch";
import { getSystemPromptSections } from "@/lib/rag/systemPrompt";
import { buildSystemPrompt, type PersonaHint } from "@/lib/rag/prompt.ts";
import { generateReply } from "@/lib/ai/chatModel";
import { checkOutput } from "@/lib/safety/outputCheck";
import { DOMAIN_LABELS } from "@/lib/wellness/domainLabels";
import { loadQuizPersona } from "@/lib/mypage/loadQuizPersona";
import { loadOnboardingPrefs } from "@/lib/onboarding/loadOnboardingPrefs";

// 출력 검사를 두 번 다 통과하지 못했을 때만 쓰는 마지막 안전망. 이 문장 자체는 규칙을 어길 수
// 없도록 고정 문구로 두었다 (진단·약물 지시·효과 보장이 전혀 없음). 문구는 "~할 수 없지만" 같은
// 부정형이 아니라 제안형으로 표현한다 (2026-09-22 ground rule).
const SAFE_FALLBACK_REPLY =
  "지금 이 부분은 조심스럽게 정리해서 답해드리고 싶어요. 정확한 상태는 정신건강의학과 등 전문가와 상담해보시는 건 어떨까요? 지금 가장 걱정되는 부분이 무엇인지 조금 더 이야기해주실 수 있을까요?";

// 5개 영역 점수를 "커리어 3.2 · 연애 2.1(요즘 더 신경 쓰이는 영역) · 관계 3.8(비교적 안정적) ..."
// 같은 한 줄로 요약한다. 같은 유형이라도 사용자마다 다른 점수를 답변에 반영하기 위함
// (2026-09-22 결정 — "모든 사람이 비슷한 결과가 나온다"는 피드백에 대한 조치).
// 2026-09-24: 심리테스트 v2에서는 점수가 "그 영역이 얼마나 건강하게 채워져 있나"를 뜻하고
// (높을수록 좋음), 가장 낮은 영역이 "주 고민 영역"이다(v1과 반대 — v1은 가장 높은 쪽이었다).
// 그래서 라벨도 단순히 "높음/낮음"이 아니라 이 의미가 드러나게 붙인다.
function summarizeThemeScores(scores: unknown): string | undefined {
  if (!scores || typeof scores !== "object") return undefined;
  const entries: (readonly [string, number])[] = [];
  for (const [k, v] of Object.entries(scores as Record<string, unknown>)) {
    if (k in DOMAIN_LABELS && typeof v === "number") entries.push([k, v] as const);
  }
  if (entries.length < 2) return undefined;

  const max = Math.max(...entries.map(([, v]) => v));
  const min = Math.min(...entries.map(([, v]) => v));
  return entries
    .map(([k, v]) => {
      const tag = v === max && max !== min ? "비교적 안정적" : v === min && max !== min ? "요즘 더 신경 쓰이는 영역" : null;
      return `${DOMAIN_LABELS[k]} ${v}${tag ? `(${tag})` : ""}`;
    })
    .join(" · ");
}

// 사용자의 웰니스 유형(디저트 유형)을 상담 관점 힌트로 쓰기 위해 불러온다.
// 2026-09-22 결정: 기본 반영, opt-out은 나중에 설정 화면이 생기면 쓸 컬럼만 미리 준비해둠.
// persona_profiles(상세 설명)·theme_scores(5개 영역 점수)는 항상 함께 불러오되, 그걸 얼마나
// 적극적으로 쓸지(subtle/characterization)는 prompt.ts에서 personaMode로 결정한다 —
// 진단이나 검색 하드 필터로는 절대 쓰지 않는다 (SAFE-005).
//
// 세션당 1회만 조회하고 그 결과를 chat_sessions.persona_snapshot에 캐시해 재사용한다
// (2026-09-22 결정). 새 대화를 시작해야 최신 정보로 다시 조회된다.
async function loadPersonaHint(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  sessionId: string,
): Promise<{ label: string | null; hint: PersonaHint | null }> {
  const { data: session } = await admin.from("chat_sessions").select("persona_snapshot").eq("session_id", sessionId).maybeSingle();
  if (session?.persona_snapshot) {
    return session.persona_snapshot as { label: string | null; hint: PersonaHint | null };
  }

  const snapshot = await computePersonaHint(admin, userId);
  await admin.from("chat_sessions").update({ persona_snapshot: snapshot }).eq("session_id", sessionId);
  return snapshot;
}

async function computePersonaHint(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{ label: string | null; hint: PersonaHint | null }> {
  // 2026-09-24: 마이페이지와 같은 방식(ssol_quiz_results 직접 조회)으로 통일 — 예전엔
  // wellness_profiles를 봤지만 실제 퀴즈 결과와 연결되지 않아 실사용자 기준으로 항상
  // 비어 있었다(위 파일 상단 import의 loadQuizPersona 주석 참고).
  const persona = await loadQuizPersona(admin, userId);
  if (!persona) return { label: null, hint: null };

  return {
    label: persona.name,
    hint: {
      label: persona.name,
      axis: DOMAIN_LABELS[persona.axisCode] ?? persona.axisCode,
      tagline: persona.tagline,
      blurb: persona.blurb,
      traits: persona.traits,
      scoresSummary: summarizeThemeScores(persona.domainScores),
      reportInsight: persona.reportInsight ?? undefined,
    },
  };
}

// "성향 질문" 칩을 눌렀는데 테스트 결과가 없는 경우: AI를 부르지 않고(비용 없음) 테스트부터
// 안내한다. 2026-09-22 결정: 이 기능만큼은 테스트가 먼저다.
const NEEDS_TEST_REPLY =
  "이 질문에 답하려면 먼저 웰니스 유형(성향) 테스트 결과가 필요해요. 아직 테스트를 하지 않으셨다면, 테스트를 완료한 뒤 다시 물어봐 주세요.";

export type GenerationUsage = { inputTokens: number; outputTokens: number };

export async function generateAnswer(params: {
  route: RouteId;
  matchedRuleIds: string[];
  message: string;
  recentMessages: { role: "user" | "assistant"; content: string }[];
  safetyRules: SafetyRule[];
  userId: string;
  sessionId: string;
  isPersonaQuestion?: boolean;
}): Promise<{
  reply: string;
  retrievedChunkIds: string[];
  frameworkId: string | null;
  usage: GenerationUsage[];
  regenerated: boolean;
}> {
  const admin = createAdminClient();
  const sections = await getSystemPromptSections();
  const matchedRules = params.safetyRules
    .filter((r) => params.matchedRuleIds.includes(r.rule_id))
    .map((r) => ({ rule_id: r.rule_id, category: r.category, rule_text: r.rule_text }));

  let knowledgeChunks: Awaited<ReturnType<typeof retrieveKnowledgeChunks>> = [];
  let serviceResults: Awaited<ReturnType<typeof searchServiceKnowledge>> = [];
  let frameworkHint: Awaited<ReturnType<typeof findFrameworkHint>> = null;

  const { label: personaLabel, hint: personaHint } = await loadPersonaHint(admin, params.userId, params.sessionId);

  if (params.isPersonaQuestion && !personaHint) {
    return { reply: NEEDS_TEST_REPLY, retrievedChunkIds: [], frameworkId: null, usage: [], regenerated: false };
  }

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

  // 실천방법 DB(owner 제공, 375개)에서 상황에 맞는 후보를 가져온다. "무엇을 해볼지" 제안이
  // 실제로 의미 있는 route(wellness/life_decision/clinical_distress)에서만, 그리고 성향 질문
  // 모드(캐릭터 해석)에서는 성격이 다른 대화라 쓰지 않는다.
  const wantsPractices =
    !params.isPersonaQuestion &&
    (params.route === "wellness" || params.route === "life_decision" || params.route === "clinical_distress");

  // 사용자가 "이 대화를 기억하기"를 선택한 이전 세션이 있을 때만 존재한다. 참고용일 뿐,
  // 검색이나 안전 판단에는 쓰지 않는다.
  // 2026-09-25: 관계/육아/업무 하드 필터는 온보딩 여부와 무관하게 채팅 실천방법 제안에도
  // 항상 적용한다(파트너 없는데 "연인과 함께" 제안이 나가지 않도록) — practicesSearch.ts.
  const onboardingPrefs = wantsPractices ? await loadOnboardingPrefs(admin, params.userId) : null;
  const [{ data: memoryRow }, { data: sessionMeta }, practiceResults] = await Promise.all([
    admin.from("user_memory").select("summary").eq("user_id", params.userId).maybeSingle(),
    admin.from("chat_sessions").select("clinical_boundary_stated_at").eq("session_id", params.sessionId).maybeSingle(),
    wantsPractices && onboardingPrefs
      ? searchWellnessPractices(params.message, params.recentMessages, onboardingPrefs.prefs)
      : Promise.resolve([]),
  ]);

  const usedClinicalChunk = knowledgeChunks.some((c) => c.clinical_sensitive);
  // 이번 세션에서 전문가 상담 안내를 이미 한 번 전달했는지 (2026-09-22 결정: 매 턴 반복 방지).
  const clinicalBoundaryAlreadyStated = usedClinicalChunk && !!sessionMeta?.clinical_boundary_stated_at;
  const system = buildSystemPrompt({
    sections,
    matchedRules,
    route: params.route,
    usedClinicalChunk,
    clinicalBoundaryAlreadyStated,
    knowledgeChunks: knowledgeChunks.length ? knowledgeChunks : undefined,
    serviceResults: serviceResults.length ? serviceResults : undefined,
    practiceResults: practiceResults.length ? practiceResults : undefined,
    frameworkHint,
    userMemory: memoryRow?.summary,
    personaHint,
    personaMode: params.isPersonaQuestion ? "characterization" : "subtle",
    // 이미 몇 번 답했는지(직전 assistant 메시지 수). 계속 되묻기만 하지 않고 어느 시점에
    // 요약·제안으로 넘어가야 하는지 판단하는 데 쓴다.
    turnCount: params.recentMessages.filter((m) => m.role === "assistant").length,
  });

  const conversation = [...params.recentMessages, { role: "user" as const, content: params.message }];
  const usage: GenerationUsage[] = [];
  let reply: string;
  let regenerated = false;

  try {
    const first = await generateReply(system, conversation);
    usage.push({ inputTokens: first.usage.inputTokens, outputTokens: first.usage.outputTokens });
    const check1 = checkOutput(first.text, { usedClinicalChunk, clinicalBoundaryAlreadyStated });

    if (check1.ok) {
      reply = first.text;
    } else {
      regenerated = true;
      const retrySystem = `${system}\n\n[내부 검수 실패 — 다시 작성] 방금 만든 답변이 아래 규칙을 어겼습니다. 같은 실수를 반복하지 말고 다시 작성하세요:\n${check1.violations.map((v) => `- ${v}`).join("\n")}`;
      const second = await generateReply(retrySystem, conversation);
      usage.push({ inputTokens: second.usage.inputTokens, outputTokens: second.usage.outputTokens });
      const check2 = checkOutput(second.text, { usedClinicalChunk, clinicalBoundaryAlreadyStated });
      reply = check2.ok ? second.text : SAFE_FALLBACK_REPLY;
      if (!check2.ok) {
        console.warn("출력 검사 2회 연속 실패, 안전한 대체 문구 사용:", check2.violations);
      }
    }
  } catch (e) {
    console.error("답변 생성 실패:", e instanceof Error ? e.message : e);
    reply = SAFE_FALLBACK_REPLY;
  }

  // 이번이 이 세션에서 처음으로 전문가 상담 안내가 나간 턴이면 기록해둔다 — 다음 턴부터는
  // 문구를 반복하지 않고 자기돌봄 제안으로 넘어가기 위함 (실패해도 답변 자체엔 영향 없음).
  if (usedClinicalChunk && !clinicalBoundaryAlreadyStated) {
    await admin
      .from("chat_sessions")
      .update({ clinical_boundary_stated_at: new Date().toISOString() })
      .eq("session_id", params.sessionId);
  }

  return {
    reply,
    retrievedChunkIds: knowledgeChunks.map((c) => c.chunk_id),
    frameworkId: frameworkHint?.framework_id ?? null,
    usage,
    regenerated,
  };
}
