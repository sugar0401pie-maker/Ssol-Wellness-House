import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { generateReply } from "@/lib/ai/chatModel";
import { getSafetyData } from "@/lib/safety/rules";
import { findKeywordHits, instantHit } from "@/lib/safety/keywordCheck";
import { checkOutput, stripForeignScript } from "@/lib/safety/outputCheck";
import { loadTarotInsight } from "@/lib/tarot/loadTarotInsight";
import { loadAstroInsight } from "@/lib/mypage/loadAstroInsight";
import { loadQuizPersona } from "@/lib/mypage/loadQuizPersona";
import { TEST_OPENING_SYSTEM_PROMPT } from "./testOpeningPrompt";
import { cleanOpening, type TestOpeningSource } from "./testOpeningSource";

type Admin = ReturnType<typeof createAdminClient>;

// 테스트를 하고 채팅에 들어온 사람에게 쏘웰라가 먼저 건네는 첫 메시지(2026-11-25 대표님: 결과 요약 → "이런 생각을 하셨군요" → "더 궁금한 고민이 있나요?").
// 결과 요약은 각 앱이 만들어 둔 chat_summary(타로·점성술) / 디저트 유형·리포트(loadQuizPersona)를 쓴다.
// 실패·안전 신호·출력 검사 탈락이면 null — 그러면 화면은 예전 고정 인사(lib/persona/welcome.ts)를 그대로 쓴다(fail safe).
async function summaryFor(admin: Admin, userId: string, src: TestOpeningSource): Promise<{ label: string; text: string } | null> {
  if (src.kind === "tarot") {
    const t = await loadTarotInsight(admin, userId, src.resultId);
    return t ? { label: "쏠 타로 하우스 타로 결과", text: t } : null;
  }
  if (src.kind === "astro") {
    const t = await loadAstroInsight(admin, userId);
    return t ? { label: "쏠 아스트로 하우스 점성술 결과", text: t } : null;
  }
  const p = await loadQuizPersona(admin, userId, { includeReport: true });
  if (!p) return null;
  const lines = [`[유형] ${p.name}`, p.tagline && `[한 줄] ${p.tagline}`, p.blurb && `[설명] ${p.blurb}`, p.reportInsight && `[심층 리포트]\n${p.reportInsight}`].filter(Boolean);
  return { label: "쏠 웰니스 하우스 디저트 유형 테스트 결과", text: lines.join("\n") };
}

export async function buildTestOpening(admin: Admin, userId: string, src: TestOpeningSource, nickname: string | null): Promise<string | null> {
  const s = await summaryFor(admin, userId, src);
  if (!s || !s.text.trim()) return null;
  const summary = s.text.slice(0, 5000);
  // 결과(특히 직접 적은 고민 글)에 위기·폭력 신호가 있으면 요약 인사를 만들지 않는다 — 고정 인사로 두고, 첫 메시지부터 안전 경로가 판단한다.
  const { rules } = await getSafetyData();
  if (instantHit(findKeywordHits(summary, rules))) return null;
  const user = `[이름] ${nickname?.trim() || "없음(이름 없이 부르기)"}\n[테스트] ${s.label}\n[테스트 결과]\n${summary}`;
  const { text } = await generateReply(TEST_OPENING_SYSTEM_PROMPT, [{ role: "user", content: user }], { maxOutputTokens: 1600, requireComplete: true });
  const out = cleanOpening(stripForeignScript(text));
  if (!out || !checkOutput(out, { usedClinicalChunk: false }).ok) return null;
  return out;
}
