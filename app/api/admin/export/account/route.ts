import { NextResponse } from "next/server";
import { auditOrBlock, clientIp, fileResponse, requireAdmin } from "@/lib/admin/server";
import { loadAccount, loadAccountChats, loadRootStates, loadTheoryNames } from "@/lib/admin/data";
import { parseRange, kstDay } from "@/lib/admin/range";
import { buildReportFacts } from "@/lib/admin/reportFacts";
import { buildAccountWorkbook } from "@/lib/admin/exportXlsx";

export const runtime = "nodejs";
export const maxDuration = 120;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 한 계정의 대화 원문(xlsx). 기간(from·to, 한국 시간 YYYY-MM-DD)을 비우면 가입부터 오늘까지 전체. 내려주기 전에 열람 기록을 남긴다.
export async function GET(req: Request) {
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
    const [chats, rootStates, names] = await Promise.all([loadAccountChats(userId, range.range), loadRootStates(userId), loadTheoryNames()]);
    const facts = buildReportFacts({ sessions: chats.sessions, messages: chats.messages, names, rootStates });
    const blocked = await auditOrBlock(gate.admin, "export_account_chats", { targetUserId: userId, ip: clientIp(req), detail: { range: range.range.label, sessions: facts.sessionCount, messages: facts.messageCount } });
    if (blocked) return blocked;
    const buf = await buildAccountWorkbook({ account, range: range.range, adminEmail: gate.admin.email, now: new Date(), facts, names });
    return fileResponse(buf, `ssowella-chats-${userId.slice(0, 8)}-${kstDay(new Date()).replaceAll("-", "")}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  } catch (e) {
    console.error("[admin/export/account]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "내려받기 파일을 만들지 못했어요." }, { status: 500 });
  }
}
