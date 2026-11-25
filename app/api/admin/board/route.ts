import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auditOrBlock, clientIp, requireAdmin } from "@/lib/admin/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBoardRows } from "@/lib/board/posts";
import { checkPostInput } from "@/lib/board/postInput";
import { STARTER_EPISODES, STARTER_GUIDES } from "@/lib/board/data";

// 고민 타파 글 쓰기(관리자 화면, 2026-11-25 대표님). 관리자 계정 + 관리자 암호가 있어야 한다. 지우지 않고 '숨기기'(published=false)만.
export const runtime = "nodejs";

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const rows = await loadBoardRows();
  // 아직 관리자 글이 없는 처음 목록(요청문 예시)도 함께 — "이어서 쓰기"로 불러올 수 있게
  return NextResponse.json({ rows, starterGuides: STARTER_GUIDES, starterEpisodes: STARTER_EPISODES }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const checked = checkPostInput(await req.json().catch(() => null));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const v = checked.value;
  const blocked = await auditOrBlock(gate.admin, "board_save", { detail: { kind: v.kind, slug: v.slug, n: v.n, published: v.published }, ip: clientIp(req) });
  if (blocked) return blocked;
  const row = { kind: v.kind, slug: v.slug, n: v.n, tag: v.tag, title: v.title, lines: v.lines, summary: v.summary, body: v.body, image: v.image, published: v.published, updated_at: new Date().toISOString() };
  const db = createAdminClient().from("board_posts");
  const res = v.id ? await db.update(row).eq("id", v.id).select("id").single() : await db.insert(row).select("id").single();
  if (res.error) {
    if (res.error.code === "23505") return NextResponse.json({ error: v.kind === "guide" ? "같은 주소 이름의 글이 이미 있어요. 목록에서 그 글을 열어 고쳐 주세요." : "같은 회차의 글이 이미 있어요. 목록에서 그 글을 열어 고쳐 주세요." }, { status: 409 });
    if (res.error.code === "42P01" || res.error.code === "PGRST205") return NextResponse.json({ error: "글 표가 아직 없어요(SQL 실행 전)." }, { status: 503 });
    console.error("[admin/board]", res.error.code);
    return NextResponse.json({ error: "저장하지 못했어요." }, { status: 500 });
  }
  // 공개 게시판은 30분마다 새로 그리지만, 저장한 글은 바로 보이게 그 화면들을 지금 새로 그리게 한다
  revalidatePath("/board");
  revalidatePath(v.kind === "guide" ? `/board/guide/${v.slug}` : `/board/post/${v.n}`);
  return NextResponse.json({ ok: true, id: (res.data as { id: string }).id });
}
