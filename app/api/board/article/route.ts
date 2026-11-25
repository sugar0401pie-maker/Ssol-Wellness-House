import { NextRequest, NextResponse } from "next/server";
import { getUserIdFast } from "@/lib/supabase/auth";
import { checkAccessCode } from "@/lib/security/accessCode";
import { articleFor, loadEpisodes, loadGuides } from "@/lib/board/fetchSite";

// 고민 가이드·고민우체국 글 한 편(요청문 10-4·10-5장). 주소는 목록에 있는 것만(요청 값으로 아무 주소나 가져오지 않음).
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  const userId = await getUserIdFast(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const kind = req.nextUrl.searchParams.get("kind");
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (kind === "guide") {
    const list = await loadGuides();
    const g = list.data.find((x) => x.slug === id);
    if (!g) return NextResponse.json({ error: "글을 찾지 못했어요." }, { status: 404 });
    const a = await articleFor(g);
    return NextResponse.json({ kind, guide: g, html: a.html, stale: a.stale || list.stale });
  }
  if (kind === "post") {
    const list = await loadEpisodes();
    const e = list.data.find((x) => String(x.n) === id);
    if (!e) return NextResponse.json({ error: "글을 찾지 못했어요." }, { status: 404 });
    const a = await articleFor(e);
    return NextResponse.json({ kind, episode: e, html: a.html, stale: a.stale || list.stale });
  }
  return NextResponse.json({ error: "알 수 없는 요청이에요." }, { status: 400 });
}
