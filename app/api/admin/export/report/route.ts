import { NextResponse } from "next/server";
import { adminSecretForCodes, auditOrBlock, clientIp, fileResponse, requireAdmin } from "@/lib/admin/server";
import { pseudonymCode } from "@/lib/admin/privacy";
import { loadAccount, loadAccountChats, loadPayment, loadRootStates, loadTheoryNames } from "@/lib/admin/data";
import { parseRange, kstDay } from "@/lib/admin/range";
import { buildReportFacts } from "@/lib/admin/reportFacts";
import { evaluateWithAi } from "@/lib/admin/reportAi";
import { buildReportDocx } from "@/lib/admin/reportDoc";
import { withUsageScope } from "@/lib/ai/usage";

export const runtime = "nodejs";
export const maxDuration = 300; // AI 평가를 기다리는 시간(보통 1~2분)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 한 계정의 이용 보고서(docx): 사실 기록(이용 요약·경고·사용한 이론) + 대화별 AI 평가 + 대화 원문.
// 이 요청은 대화 글을 AI 제공사(OpenAI)로 보내 평가를 받는다(채팅과 같은 경로). 열람 기록에도 그 사실을 남긴다.
async function handleGET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const sp = new URL(req.url).searchParams;
  const userId = sp.get("userId") ?? "";
  if (!UUID.test(userId)) return NextResponse.json({ error: "계정을 선택해 주세요." }, { status: 400 });
  const range = parseRange(sp.get("from"), sp.get("to"));
  if (!range.ok) return NextResponse.json({ error: range.error }, { status: 400 });

  try {
    const account = await loadAccount(userId);
    if (!account) return NextResponse.json({ error: "계정을 찾지 못했어요." }, { status: 404 });
    const [chats, rootStates, names, payment] = await Promise.all([loadAccountChats(userId, range.range), loadRootStates(userId), loadTheoryNames(), loadPayment(userId)]);
    const facts = buildReportFacts({ sessions: chats.sessions, messages: chats.messages, names, rootStates });
    const blocked = await auditOrBlock(gate.admin, "export_account_report", { targetUserId: userId, ip: clientIp(req), detail: { range: range.range.label, sessions: facts.sessionCount, messages: facts.messageCount, sentToAi: true } });
    if (blocked) return blocked;
    const ai = facts.sessionCount ? await evaluateWithAi(facts) : { overall: null, perSession: new Map<string, string>(), error: null, evaluatedSessions: 0 };
    const buf = await buildReportDocx({ account: { ...account, code: pseudonymCode(userId, adminSecretForCodes()), payment: payment.label }, range: range.range, adminEmail: gate.admin.email, now: new Date(), facts, ai });
    return fileResponse(buf, `ssowella-report-${userId.slice(0, 8)}-${kstDay(new Date()).replaceAll("-", "")}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  } catch (e) {
    console.error("[admin/export/report]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "보고서를 만들지 못했어요." }, { status: 500 });
  }
}

// AI 사용량 기록(ai_usage_log)에 이 요청의 기능 이름·사용자를 붙이려고 요청 전체를 사용량 범위로 감싼다(lib/ai/usage.ts).
export function GET(req: Request) {
  return withUsageScope("admin_export_report", () => handleGET(req));
}
