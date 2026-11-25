import "server-only";
import { GUIDE_INDEX_URL, POST_INDEX_URL, STARTER_EPISODES, STARTER_GUIDES, episodeUrl, guideUrl, isPublishedOn, type Episode, type Guide } from "./data";
import { extractMain, isAllowedUrl, sanitizeHtml } from "./sanitize";
import { loadDbPosts } from "./posts";
import { renderBody } from "./markdown";
import { COMMON_TAGS, KIND_TAG, tagsFor } from "./tags";
import { todayKeyKST } from "@/lib/safety/dailyLimit";

// 공개 사이트에서 고민 가이드·고민우체국을 가져온다(요청문 10-2장). 우리 도메인만, 30분 캐시(Next fetch), 실패하면 마지막으로 가져온 내용 + stale 표시.
// 공개 목록이 아직 없으면(404) 처음 목록(data.ts)을 쓰고 안내는 띄우지 않는다 — 사이트가 "안 열린" 게 아니라 "아직 안 올린" 것이라서.
const REVALIDATE = 1800;
const TIMEOUT_MS = 6000;
const lastGood = new Map<string, unknown>();

type Got<T> = { data: T; stale: boolean; source: "site" | "starter" };

async function get(url: string, kind: "json" | "text"): Promise<{ status: "ok"; body: unknown } | { status: "missing" } | { status: "error" }> {
  if (!isAllowedUrl(url)) return { status: "error" };
  try {
    const res = await fetch(url, { next: { revalidate: REVALIDATE }, signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: kind === "json" ? "application/json" : "text/html" } });
    if (res.status === 404 || res.status === 410) return { status: "missing" };
    if (!res.ok) return { status: "error" };
    return { status: "ok", body: kind === "json" ? await res.json() : await res.text() };
  } catch {
    return { status: "error" };
  }
}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// 공개 목록 데이터(제안 형식): [{ tag, slug, title, lines: [3줄], url?, updated? }]
function parseGuides(body: unknown): Guide[] {
  const arr = Array.isArray(body) ? body : Array.isArray((body as { items?: unknown })?.items) ? (body as { items: unknown[] }).items : [];
  return arr
    .map((x) => {
      const o = x as Record<string, unknown>;
      const slug = str(o.slug, 80).replace(/[^a-z0-9-]/gi, "");
      const url = str(o.url, 300) || (slug ? guideUrl(slug) : "");
      const lines = Array.isArray(o.lines) ? o.lines.map((l) => str(l, 120)).filter(Boolean).slice(0, 3) : [];
      return { tag: str(o.tag, 20).replace(/^#/, ""), slug, title: str(o.title, 120), lines, url, updated: str(o.updated, 30) || null };
    })
    .filter((g) => g.tag && g.slug && g.title && isAllowedUrl(g.url));
}

// [{ n, title, tag, summary, url?, published?, image? }]
function parseEpisodes(body: unknown): Episode[] {
  const arr = Array.isArray(body) ? body : Array.isArray((body as { items?: unknown })?.items) ? (body as { items: unknown[] }).items : [];
  return arr
    .map((x) => {
      const o = x as Record<string, unknown>;
      const n = Number(o.n);
      const image = str(o.image, 300);
      return { n, title: str(o.title, 120), tag: str(o.tag, 20).replace(/^#/, ""), summary: str(o.summary, 600), url: str(o.url, 300) || episodeUrl(n), published: str(o.published, 30) || null, image: image && isAllowedUrl(image) ? image : null };
    })
    .filter((e) => Number.isInteger(e.n) && e.n > 0 && e.title && isAllowedUrl(e.url))
    .sort((a, b) => a.n - b.n);
}

async function list<T>(url: string, parse: (b: unknown) => T[], starter: T[]): Promise<Got<T[]>> {
  const r = await get(url, "json");
  if (r.status === "ok") {
    const items = parse(r.body);
    if (items.length) {
      lastGood.set(url, items);
      return { data: items, stale: false, source: "site" };
    }
  }
  const prev = lastGood.get(url) as T[] | undefined;
  if (r.status === "error" && prev) return { data: prev, stale: true, source: "site" };
  return { data: starter, stale: r.status === "error", source: "starter" };
}

const withFallback = (t: string[], kind: "guide" | "post") => (t.length > COMMON_TAGS.length + 1 ? t : [...COMMON_TAGS, KIND_TAG[kind]]);

// 2026-11-25 대표님: 글은 관리자 화면에서 쓴다 — 관리자 글(board_posts)이 같은 주소 이름·회차의 처음 목록·공개 사이트 글을 덮고, 숨긴 글은 빠진다.
function merge<T>(base: T[], mine: T[], key: (x: T) => string | number, hidden: Set<string | number>): T[] {
  const out = new Map<string | number, T>();
  for (const x of base) if (!hidden.has(key(x))) out.set(key(x), x);
  for (const x of mine) out.set(key(x), x);
  return [...out.values()];
}

export async function loadGuides(): Promise<Got<Guide[]>> {
  const [base, db] = await Promise.all([list(GUIDE_INDEX_URL, parseGuides, STARTER_GUIDES), loadDbPosts()]);
  // 태그 40개(대표님 2026-11-25): 관리자 글은 적은 태그, 아니면 정해 둔 태그(lib/board/tags.ts), 그것도 없으면 공통 태그
  const tagged = merge(base.data, db.guides, (g) => g.slug, db.hiddenSlugs as Set<string | number>).map((g) => ({ ...g, tags: g.tags?.length ? g.tags : withFallback(tagsFor("guide", g.slug), "guide") }));
  return { ...base, data: tagged };
}
export async function loadEpisodes(): Promise<Got<Episode[]>> {
  const [base, db] = await Promise.all([list(POST_INDEX_URL, parseEpisodes, STARTER_EPISODES), loadDbPosts()]);
  // 앱에 넣어 둔 회차(고민우체국 1~5화)는 본문을 바로 그린다. 관리자 화면에서 같은 회차를 고쳐도 캐러셀 그림은 앱에 넣어 둔 것을 쓴다.
  const today = todayKeyKST();
  const withBody = base.data.map((e) => (e.body !== undefined && e.bodyHtml === undefined ? { ...e, bodyHtml: e.body.trim() ? sanitizeHtml(renderBody(e.body), e.url) : null } : e));
  const starterByN = new Map(withBody.map((e) => [e.n, e]));
  // 관리자 화면에서 고친 회차도 앱에 넣어 둔 그림과 예약 날짜를 그대로 따른다(예약 회차를 미리 고쳐도 그날 전에는 안 보임)
  const mine = db.episodes.map((e) => ({ ...e, images: e.images ?? starterByN.get(e.n)?.images, publishAt: e.publishAt ?? starterByN.get(e.n)?.publishAt }));
  const merged = merge(withBody, mine, (e) => e.n, db.hiddenNs as Set<string | number>);
  const tagged = merged.map((e) => ({ ...e, tags: e.tags?.length ? e.tags : withFallback(tagsFor("post", e.n), "post") }));
  return { ...base, data: tagged.filter((e) => isPublishedOn(e, today)).sort((a, b) => a.n - b.n) };
}

// 글 한 편의 본문 — 관리자 글이면 그 본문, 아니면 주소에서 가져온다.
export async function articleFor(item: { url: string; bodyHtml?: string | null }): Promise<{ html: string | null; stale: boolean }> {
  if (item.bodyHtml !== undefined) return { html: item.bodyHtml, stale: false };
  return loadArticle(item.url);
}

// 글 본문 — 허용한 태그만 남긴 HTML. 아직 안 올린 글이면 html: null.
export async function loadArticle(url: string): Promise<{ html: string | null; stale: boolean }> {
  const r = await get(url, "text");
  if (r.status === "ok") {
    const html = sanitizeHtml(extractMain(String(r.body)), url);
    lastGood.set(url, html);
    return { html: html || null, stale: false };
  }
  const prev = lastGood.get(url) as string | undefined;
  if (r.status === "error") return { html: prev ?? null, stale: true };
  return { html: null, stale: false };
}
