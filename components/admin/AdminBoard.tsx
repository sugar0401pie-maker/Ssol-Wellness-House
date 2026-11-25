"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/supabase/browser";
import { renderBody } from "@/lib/board/markdown";
import { sanitizeHtml } from "@/lib/board/sanitize";
import type { Episode, Guide } from "@/lib/board/data";

// 고민 타파 글 쓰기(2026-11-25 대표님: "게시판 만들어주면 거기에 올릴 거여"). 여기서 저장하면 공개 게시판(/board)과 앱 안 고민 타파(/worry)에 보인다.
// 지우기는 없고 '공개' 체크를 풀면 숨겨진다. 아직 글이 없는 처음 목록(요청문 예시 11편·3화)은 "이어서 쓰기"로 불러와 본문을 채운다.

type Row = { id: string; kind: "guide" | "post"; slug: string | null; n: number | null; tag: string; title: string; lines: string[]; summary: string | null; body: string; image: string | null; published: boolean; updated_at: string };
type Form = { id?: string; kind: "guide" | "post"; slug: string; n: string; tag: string; title: string; lines: [string, string, string]; summary: string; body: string; image: string; published: boolean };
const EMPTY: Form = { kind: "guide", slug: "", n: "", tag: "", title: "", lines: ["", "", ""], summary: "", body: "", image: "", published: true };

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  return fetch(path, { ...init, headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, cache: "no-store" });
}

const fromRow = (r: Row): Form => ({
  id: r.id,
  kind: r.kind,
  slug: r.slug ?? "",
  n: r.n ? String(r.n) : "",
  tag: r.tag,
  title: r.title,
  lines: [r.lines[0] ?? "", r.lines[1] ?? "", r.lines[2] ?? ""],
  summary: r.summary ?? "",
  body: r.body,
  image: r.image ?? "",
  published: r.published,
});

const input = "w-full rounded-[10px] border border-line px-3 py-2 text-[14px]";

export default function AdminBoard({ onNeedPassword }: { onNeedPassword: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [starterG, setStarterG] = useState<Guide[]>([]);
  const [starterE, setStarterE] = useState<Episode[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  const load = useCallback(async () => {
    const res = await api("/api/admin/board");
    if (res.status === 401) return onNeedPassword();
    const j = (await res.json().catch(() => ({}))) as { rows?: Row[]; starterGuides?: Guide[]; starterEpisodes?: Episode[]; error?: string };
    if (!res.ok) return setMsg(j.error ?? "불러오지 못했어요.");
    setRows(j.rows ?? []);
    setStarterG(j.starterGuides ?? []);
    setStarterE(j.starterEpisodes ?? []);
  }, [onNeedPassword]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 1회 목록 불러오기(표준 데이터 패칭 패턴)
  useEffect(() => { void load(); }, [load]);

  const guidesTodo = starterG.filter((g) => !rows.some((r) => r.kind === "guide" && r.slug === g.slug));
  const postsTodo = starterE.filter((e) => !rows.some((r) => r.kind === "post" && r.n === e.n));
  const previewHtml = useMemo(() => (preview ? sanitizeHtml(renderBody(form.body), "https://app.ssolwellnesshouse.com/board") : ""), [preview, form.body]);
  const set = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const res = await api("/api/admin/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: form.id, kind: form.kind, slug: form.slug, n: form.n, tag: form.tag, title: form.title, lines: form.lines, summary: form.summary, body: form.body, image: form.image, published: form.published }),
      });
      if (res.status === 401) return onNeedPassword();
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || !j.ok) return setMsg(j.error ?? "저장하지 못했어요.");
      set({ id: j.id });
      const path = form.kind === "guide" ? `/board/guide/${form.slug.trim().toLowerCase()}` : `/board/post/${form.n}`;
      setMsg(`저장했어요. ${form.published ? `공개 주소: app.ssolwellnesshouse.com${path}  (바로 보여요)` : "숨긴 상태예요."}`);
      void load();
    } catch {
      setMsg("네트워크 오류로 저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-line bg-white p-6">
      <h2 className="mb-1 text-[16px] font-medium text-navy">고민 타파 글 쓰기</h2>
      <p className="mb-4 text-[12.5px] leading-5 text-slate-500">저장하면 공개 게시판(/board)과 앱 안 고민 타파에 보여요. 지우기 대신 &lsquo;공개&rsquo; 체크를 풀면 숨겨져요.</p>

      <div className="space-y-1.5 text-[13px]">
        {rows.map((r) => (
          <button key={r.id} type="button" onClick={() => { setForm(fromRow(r)); setMsg(""); }} className="flex w-full items-center justify-between rounded-[10px] border border-line px-3 py-2 text-left">
            <span className="min-w-0 truncate">{r.kind === "guide" ? `#${r.tag} · ${r.title}` : `고민우체국 ${r.n}화 · ${r.title}`}</span>
            <span className={`ml-2 flex-none text-[11.5px] ${r.published ? "text-navy" : "text-slate-400"}`}>{r.published ? "공개" : "숨김"}</span>
          </button>
        ))}
        {[...guidesTodo.map((g) => ({ note: "본문 없음 · 이어서 쓰기", key: g.slug, label: `#${g.tag} · ${g.title}`, f: { ...EMPTY, kind: "guide" as const, slug: g.slug, tag: g.tag, title: g.title, lines: [g.lines[0] ?? "", g.lines[1] ?? "", g.lines[2] ?? ""] as [string, string, string] } })),
          ...postsTodo.map((e) => ({ note: "앱에 넣어 둔 글 · 고치기", key: `p${e.n}`, label: `고민우체국 ${e.n}화 · ${e.title}`, f: { ...EMPTY, kind: "post" as const, n: String(e.n), tag: e.tag, title: e.title, summary: e.summary, body: e.body ?? "" } }))].map((x) => (
          <button key={x.key} type="button" onClick={() => { setForm(x.f); setMsg(""); }} className="flex w-full items-center justify-between rounded-[10px] border border-dashed border-line px-3 py-2 text-left text-slate-500">
            <span className="min-w-0 truncate">{x.label}</span>
            <span className="ml-2 flex-none text-[11.5px]">{x.note}</span>
          </button>
        ))}
        <button type="button" onClick={() => { setForm(EMPTY); setMsg(""); }} className="w-full rounded-[10px] bg-navy-soft px-3 py-2 text-[13px] font-medium text-navy">+ 새 글</button>
      </div>

      <div className="mt-5 space-y-3 border-t border-line pt-5 text-[13px]">
        <div className="flex gap-2">
          {(["guide", "post"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={form.kind === k} onClick={() => set({ kind: k })} disabled={!!form.id} className={`flex-1 rounded-full border px-3 py-1.5 ${form.kind === k ? "border-navy bg-navy text-white" : "border-line"} disabled:opacity-60`}>
              {k === "guide" ? "고민 가이드" : "고민우체국"}
            </button>
          ))}
        </div>
        <label className="block">태그<input className={input} value={form.tag} onChange={(e) => set({ tag: e.target.value })} placeholder="예: 썸 (#은 빼고)" /></label>
        {form.kind === "guide" ? (
          <label className="block">주소 이름<input className={input} value={form.slug} onChange={(e) => set({ slug: e.target.value })} placeholder="예: is-this-ssom (영어 소문자·숫자·하이픈)" disabled={!!form.id} /></label>
        ) : (
          <label className="block">회차<input className={input} inputMode="numeric" value={form.n} onChange={(e) => set({ n: e.target.value })} placeholder="예: 4" disabled={!!form.id} /></label>
        )}
        <label className="block">제목<input className={input} value={form.title} onChange={(e) => set({ title: e.target.value })} /></label>
        {form.kind === "guide" ? (
          <fieldset className="space-y-1.5">
            <legend>먼저 한 줄로(3줄)</legend>
            {form.lines.map((l, i) => (
              <input key={i} className={input} value={l} onChange={(e) => { const lines = [...form.lines] as [string, string, string]; lines[i] = e.target.value; set({ lines }); }} placeholder={`${i + 1}번째 줄`} />
            ))}
          </fieldset>
        ) : (
          <>
            <label className="block">줄거리<textarea className={input} rows={3} value={form.summary} onChange={(e) => set({ summary: e.target.value })} /></label>
            <label className="block">표지 그림 주소(선택)<input className={input} value={form.image} onChange={(e) => set({ image: e.target.value })} placeholder="비우면 앱에 넣어 둔 그림(1~3화)" /></label>
          </>
        )}
        <label className="block">
          본문
          <textarea className={`${input} font-mono text-[13px]`} rows={14} value={form.body} onChange={(e) => set({ body: e.target.value })} placeholder={"빈 줄 = 문단 나눔\n## 소제목\n- 목록\n1. 번호 목록\n**굵게**\n[글자](주소)"} />
        </label>
        <p className="text-[11.5px] leading-5 text-slate-400">빈 줄로 문단을 나눠요. ## 소제목 · - 목록 · 1. 번호 목록 · &gt; 인용 · **굵게** · [글자](주소). 링크는 쏠 웰니스 하우스 주소만 살아나요.</p>
        <button type="button" onClick={() => setPreview((p) => !p)} className="text-[12.5px] text-navy underline underline-offset-2">{preview ? "미리보기 닫기" : "본문 미리보기"}</button>
        {preview && (
          <div className="rounded-[10px] border border-line p-3 text-[14px] leading-7 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_h2]:mt-3 [&_h2]:font-bold [&_h3]:mt-2 [&_h3]:font-bold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mt-2 [&_ul]:list-disc" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        )}
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.published} onChange={(e) => set({ published: e.target.checked })} /> 공개(체크를 풀면 숨겨져요)</label>
        <button type="button" disabled={busy} onClick={() => void save()} className="w-full rounded-[10px] bg-navy px-4 py-2.5 text-[14px] font-medium text-white disabled:opacity-50">{busy ? "저장하는 중…" : form.id ? "고친 내용 저장" : "새 글 저장"}</button>
        {msg && <p className="text-[12.5px] leading-5 text-slate-600">{msg}</p>}
      </div>
    </section>
  );
}
