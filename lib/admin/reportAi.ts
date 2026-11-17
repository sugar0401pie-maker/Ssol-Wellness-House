import "server-only";
import { generateLongText } from "@/lib/ai/reportModel";
import type { ReportFacts } from "./reportFacts.ts";
import { OVERALL_SYSTEM, SESSION_SYSTEM, buildBatches, overallPrompt, parseBatchOutput, sessionBlock } from "./reportPrompts.ts";

export type ReportAi = { overall: string | null; perSession: Map<string, string>; error: string | null; evaluatedSessions: number };

// 묶음별 평가 + 종합 평가를 한꺼번에(병렬) 요청한다. 일부가 실패해도 나머지는 살리고, 실패한 부분은 보고서에 "만들지 못했어요"로 적는다(원문·사실 부분은 항상 나온다).
export async function evaluateWithAi(facts: ReportFacts): Promise<ReportAi> {
  const batches = buildBatches(facts.sessions);
  const jobs = [
    ...batches.map((b) => generateLongText(SESSION_SYSTEM, b.map(sessionBlock).join("\n\n"), 700 * b.length + 400).then((t) => ({ kind: "batch" as const, text: t, codes: b.map((s) => s.code) }))),
    ...(facts.sessions.length ? [generateLongText(OVERALL_SYSTEM, overallPrompt(facts), 1500).then((t) => ({ kind: "overall" as const, text: t }))] : []),
  ];
  const results = await Promise.allSettled(jobs);
  const perSession = new Map<string, string>();
  let overall: string | null = null;
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === "rejected") { errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason)); continue; }
    if (r.value.kind === "overall") overall = r.value.text;
    else for (const [code, text] of parseBatchOutput(r.value.text, r.value.codes)) perSession.set(code, text);
  }
  return { overall, perSession, error: errors.length ? errors.slice(0, 2).join(" / ") : null, evaluatedSessions: batches.flat().length };
}
