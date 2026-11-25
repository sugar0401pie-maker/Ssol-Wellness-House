import "server-only";
import { GUIDE_INDEX_URL, POST_INDEX_URL, STARTER_EPISODES, STARTER_GUIDES, episodeUrl, guideUrl, type Episode, type Guide } from "./data";
import { extractMain, isAllowedUrl, sanitizeHtml } from "./sanitize";

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

export const loadGuides = () => list(GUIDE_INDEX_URL, parseGuides, STARTER_GUIDES);
export const loadEpisodes = () => list(POST_INDEX_URL, parseEpisodes, STARTER_EPISODES);

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
