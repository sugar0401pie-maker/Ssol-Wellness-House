import { NextResponse } from "next/server";
import { adminSecretForCodes, auditOrBlock, clientIp, fileResponse, requireAdmin } from "@/lib/admin/server";
import { loadAllChats, loadTheoryNames } from "@/lib/admin/data";
import { parseRange, kstDay } from "@/lib/admin/range";
import { buildBulkWorkbook } from "@/lib/admin/exportXlsx";

export const runtime = "nodejs";
export const maxDuration = 300;

// 전체 대화 종합(xlsx) — 내부 라운드테이블 검토용. 이용자는 코드로만 표시하고 연락처·건강 직접 표현은 가리며, 품질 개선 활용을 거부한 계정은 뺀다.
export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const sp = new URL(req.url).searchParams;
  const range = parseRange(sp.get("from"), sp.get("to"));
  if (!range.ok) return NextResponse.json({ error: range.error }, { status: 400 });

  try {
    const [all, names] = await Promise.all([loadAllChats(range.range), loadTheoryNames()]);
    const blocked = await auditOrBlock(gate.admin, "export_all_chats", { ip: clientIp(req), detail: { range: range.range.label, users: all.includedUsers, excludedUsers: all.excludedUsers, sessions: all.sessions.length, messages: all.messages.length } });
    if (blocked) return blocked;
    const buf = await buildBulkWorkbook({ sessions: all.sessions, messages: all.messages, range: range.range, adminEmail: gate.admin.email, now: new Date(), includedUsers: all.includedUsers, excludedUsers: all.excludedUsers, names, secret: adminSecretForCodes() });
    return fileResponse(buf, `ssowella-all-chats-${kstDay(new Date()).replaceAll("-", "")}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  } catch (e) {
    console.error("[admin/export/all]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "종합 파일을 만들지 못했어요." }, { status: 500 });
  }
}
