import { NextResponse } from "next/server";
import { auditOrBlock, clientIp, requireAdmin } from "@/lib/admin/server";
import { searchAccounts } from "@/lib/admin/data";

export const runtime = "nodejs";
export const maxDuration = 60;

// 이메일·이름·닉네임으로 계정 찾기(최대 20개). 검색 자체도 기록한다(검색어 글자 수만 — 검색어는 남기지 않는다).
export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ error: "두 글자 이상 입력해 주세요." }, { status: 400 });
  const blocked = await auditOrBlock(gate.admin, "search", { detail: { queryLength: q.length }, ip: clientIp(req) });
  if (blocked) return blocked;
  try {
    return NextResponse.json({ results: await searchAccounts(q) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/search]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "검색하지 못했어요." }, { status: 500 });
  }
}
