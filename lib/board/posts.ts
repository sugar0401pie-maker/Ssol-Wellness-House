import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/seo/paths";
import type { Episode, Guide } from "./data";
import { renderBody } from "./markdown";
import { isAllowedUrl, sanitizeHtml } from "./sanitize";

// 관리자 화면에서 쓴 고민 타파 글(board_posts, 2026-11-25). 공개 게시판·앱 안 고민 타파가 이 글을 가장 먼저 쓴다(lib/board/fetchSite.ts).
// 표가 아직 없거나 못 읽으면 빈 목록(처음 목록·공개 사이트로 이어진다).
export type BoardPostRow = {
  id: string;
  kind: "guide" | "post";
  slug: string | null;
  n: number | null;
  tag: string;
  title: string;
  lines: string[];
  summary: string | null;
  body: string;
  image: string | null;
  published: boolean;
  updated_at: string;
  tags?: string[] | null; // 2026-11-25 추가 칸(SQL 실행 전에는 없음)
};

export const boardUrl = (kind: "guide" | "post", id: string | number) => `${SITE_URL}/board/${kind}/${id}`;
const html = (row: BoardPostRow) => (row.body.trim() ? sanitizeHtml(renderBody(row.body), boardUrl(row.kind, row.slug ?? row.n ?? "")) : null);

export async function loadBoardRows(): Promise<BoardPostRow[]> {
  const { data, error } = await createAdminClient().from("board_posts").select("*") /* tags 칸이 아직 없어도 읽히게 */.order("kind").order("n").order("slug");
  if (error) {
    console.warn("고민 타파 글 불러오기 실패:", error.code);
    return [];
  }
  return (data ?? []) as BoardPostRow[];
}

export async function loadDbPosts(): Promise<{ guides: Guide[]; episodes: Episode[]; hiddenSlugs: Set<string>; hiddenNs: Set<number> }> {
  const rows = await loadBoardRows();
  const guides: Guide[] = [];
  const episodes: Episode[] = [];
  const hiddenSlugs = new Set<string>();
  const hiddenNs = new Set<number>();
  for (const r of rows) {
    if (r.kind === "guide" && r.slug) {
      if (!r.published) hiddenSlugs.add(r.slug);
      else guides.push({ tag: r.tag, slug: r.slug, title: r.title, lines: (r.lines ?? []).filter(Boolean).slice(0, 3), url: boardUrl("guide", r.slug), updated: r.updated_at, bodyHtml: html(r), tags: r.tags?.length ? r.tags : undefined });
    }
    if (r.kind === "post" && r.n) {
      if (!r.published) hiddenNs.add(r.n);
      else episodes.push({ n: r.n, title: r.title, tag: r.tag, summary: r.summary ?? "", url: boardUrl("post", r.n), published: r.updated_at, image: r.image && isAllowedUrl(r.image) ? r.image : null, bodyHtml: html(r), tags: r.tags?.length ? r.tags : undefined });
    }
  }
  return { guides, episodes, hiddenSlugs, hiddenNs };
}
