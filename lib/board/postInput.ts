// 관리자 화면에서 보낸 고민 타파 글을 확인한다(2026-11-25) — 순수 함수, 서버가 쓰고 테스트한다.
export type PostInput = {
  id?: string;
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
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function checkPostInput(raw: unknown): { ok: true; value: PostInput } | { ok: false; error: string } {
  const o = (raw ?? {}) as Record<string, unknown>;
  const kind = o.kind === "post" ? "post" : o.kind === "guide" ? "guide" : null;
  if (!kind) return { ok: false, error: "글 종류를 골라 주세요." };
  const tag = str(o.tag, 20).replace(/^#/, "");
  const title = str(o.title, 120);
  if (!tag) return { ok: false, error: "태그를 적어 주세요(예: 썸)." };
  if (!title) return { ok: false, error: "제목을 적어 주세요." };
  const body = typeof o.body === "string" ? o.body.replace(/\r\n?/g, "\n").slice(0, 30000) : "";
  const id = typeof o.id === "string" && /^[0-9a-f-]{36}$/i.test(o.id) ? o.id : undefined;
  const published = o.published !== false;
  const image = str(o.image, 300) || null;
  if (kind === "guide") {
    const slug = str(o.slug, 80).toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { ok: false, error: "주소 이름은 영어 소문자·숫자·하이픈(-)으로 적어 주세요(예: is-this-ssom)." };
    const lines = (Array.isArray(o.lines) ? o.lines : []).map((l) => str(l, 120)).filter(Boolean).slice(0, 3);
    if (lines.length === 0) return { ok: false, error: "'먼저 한 줄로'를 한 줄 이상 적어 주세요." };
    return { ok: true, value: { id, kind, slug, n: null, tag, title, lines, summary: null, body, image: null, published } };
  }
  const n = Number(o.n);
  if (!Number.isInteger(n) || n < 1 || n > 999) return { ok: false, error: "회차를 숫자로 적어 주세요(예: 4)." };
  const summary = str(o.summary, 600);
  if (!summary) return { ok: false, error: "줄거리를 적어 주세요." };
  return { ok: true, value: { id, kind, slug: null, n, tag, title, lines: [], summary, body, image, published } };
}
