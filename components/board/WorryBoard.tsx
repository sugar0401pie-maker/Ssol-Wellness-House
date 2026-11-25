"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { BASIS_SUB, CLOUD_MAX, POST_INTRO_IMAGE, scoreOf, type Basis, type Episode, type Guide } from "@/lib/board/data";
import { boldFor, colorFor, layoutCloud } from "@/lib/board/cloud";
import { LatestInsightCard } from "@/components/app/InsightsSection";

// 고민 타파(요청문 v1.9.4 10장): 맨 위 "쏘웰라가 알게 된 마음"(대표님 2026-11-24: 고민타파에 들어가면 제일 위에) → 제목·부제 →
// 해시태그 글자 구름(이 사람에게 가까운 고민이 크게, 천천히 떠다님) → 고른 고민 패널(이름표·제목·먼저 한 줄로 3줄·글 읽기) → 고민우체국 연재.
// 글은 공개 사이트에서 가져온다(app/api/board). 못 가져오면 마지막 내용 + 작은 안내.

type Payload = { guides: Guide[]; episodes: Episode[]; basis: Basis; stale: boolean };
type TokenFn = () => Promise<string | null>;

export default function WorryBoard({ getToken = getAccessToken }: { getToken?: TokenFn } = {}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState(false);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("login");
        const res = await fetch("/api/board", { headers: authHeaders(token), cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const j = (await res.json()) as Payload;
        if (!cancelled) setData(j);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 열 때 한 번
  }, []);

  // 점수가 높은 순서로(Tab 순서도 같다), 한 번에 최대 12개.
  const items = useMemo(() => {
    if (!data) return [];
    return data.guides
      .map((g, i) => ({ g, i, score: scoreOf(data.basis, g.tag) }))
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .slice(0, CLOUD_MAX);
  }, [data]);
  const pos = useMemo(() => layoutCloud(items.map((x) => ({ key: x.g.slug, label: `#${x.g.tag}`, score: x.score }))), [items]);
  const selected = items.find((x) => x.g.slug === sel)?.g ?? items[0]?.g ?? null;

  return (
    <div className="h-full overflow-y-auto bg-[image:var(--sky-text-bg)] text-night-text">
      <div className="mx-auto max-w-md pb-10" style={{ containerType: "inline-size" }}>
        <div className="[&>div]:border-b-0 [&_.bg-navy-soft]:bg-night-panel [&_.bg-navy-soft]:text-night-text [&_p]:!text-inherit">
          <LatestInsightCard />
        </div>
        <div className="px-5 pt-4">
          <h1 className="text-[22px] font-bold">고민 타파</h1>
          {data && <p className="mt-1 text-[13.5px] leading-5 text-night-sub">{BASIS_SUB[data.basis]}</p>}
          {error && <p className="mt-6 text-[13.5px] text-night-yellow">지금은 최신 글을 못 가져왔어요. 조금 뒤에 다시 열어 주세요.</p>}
          {!data && !error && <p className="mt-6 text-[13.5px] text-night-dim">불러오는 중…</p>}
          {data?.stale && <p className="mt-1 text-[12px] text-night-yellow">지금은 최신 글을 못 가져왔어요. 조금 뒤에 다시 열어 주세요.</p>}
        </div>

        {data && (
          <>
            <div
              role="group"
              aria-label="요즘 많이 나오는 고민"
              className="relative mx-auto mt-3 overflow-hidden rounded-[7cqw]"
              style={{ width: "88cqw", height: "66cqw", background: "radial-gradient(ellipse at 50% 50%, rgba(91,121,166,.28), rgba(8,20,42,.35) 70%)" }}
            >
              {items.map(({ g, score }, k) => {
                const p = pos[g.slug];
                if (!p) return null;
                const on = selected?.slug === g.slug;
                return (
                  <button
                    key={g.slug}
                    type="button"
                    aria-label={`${g.tag} 고민 글 보기`}
                    aria-pressed={on}
                    onClick={() => setSel(g.slug)}
                    className="ssol-cloud-tag absolute whitespace-nowrap leading-none"
                    style={{
                      left: `${p.x}cqw`,
                      top: `${p.y}cqw`,
                      fontSize: `${p.f}cqw`,
                      color: colorFor(score),
                      fontWeight: boldFor(score) ? 700 : 400,
                      // 작은 글자도 누르는 영역이 44px 이상 되게 투명한 여백을 둔다(배치는 글자 상자 기준 그대로)
                      padding: "max(0px, calc((44px - 1.3em) / 2)) 0",
                      margin: "calc(-1 * max(0px, calc((44px - 1.3em) / 2))) 0",
                      textDecoration: on ? "underline" : undefined,
                      textUnderlineOffset: "0.2em",
                    }}
                  >
                    <span
                      className="ssol-float inline-block"
                      style={{ ["--dx" as string]: `${(0.7 + ((k * 37) % 10) / 8).toFixed(2)}cqw`, ["--dy" as string]: `${(0.6 + ((k * 53) % 10) / 9).toFixed(2)}cqw`, ["--d" as string]: `${(4.5 + ((k * 29) % 10) / 3).toFixed(1)}s`, ["--dl" as string]: `-${(((k * 13) % 7) * 0.9).toFixed(1)}s` }}
                    >
                      #{g.tag}
                    </span>
                  </button>
                );
              })}
            </div>

            {selected && (
              <div className="mx-5 mt-3 rounded-2xl border border-night-line bg-night-panel p-4" aria-live="polite">
                <p className="text-[12.5px] text-night-amber">#{selected.tag} · 고민 가이드</p>
                <p className="mt-1 text-[16.5px] font-bold leading-snug">{selected.title}</p>
                <ol className="mt-2 list-decimal pl-5 text-[13.5px] leading-6 text-night-sub">
                  {selected.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ol>
                <Link href={`/worry/guide/${selected.slug}`} className="mt-3 block rounded-full bg-night-amber py-2.5 text-center text-[15px] font-bold text-night-on-amber">
                  글 읽기
                </Link>
              </div>
            )}

            <section className="mx-5 mt-8">
              <div className="flex items-center gap-3">
                <Image src={POST_INTRO_IMAGE} alt="편지를 여는 해달 우체부" width={72} height={72} unoptimized className="h-[72px] w-[72px] flex-none rounded-2xl object-cover" />
                <div>
                  <h2 className="text-[19px] font-bold">고민우체국</h2>
                  <p className="mt-0.5 break-keep text-[12.5px] leading-5 text-night-sub">1화, 2화로 이어지는 연재예요. 창작 이야기이며 실제 이용자 사연이 아니에요.</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                {data.episodes.map((e, i) => (
                  <Link key={e.n} href={`/worry/post/${e.n}`} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-night-line bg-night-panel py-3 pl-4 pr-3">
                    <span className="grid h-[54px] w-[48px] rotate-[-3deg] place-items-center rounded bg-[#f6e3b4] text-[15px] font-bold text-night-on-amber outline-2 outline-offset-2 outline-dashed outline-[#f6e3b4]">{e.n}화</span>
                    <span className="min-w-0">
                      <b className="block text-[14.5px] leading-snug">{e.title}</b>
                      <small className="text-[12px] text-night-dim">#{e.tag}</small>
                    </span>
                    {i === data.episodes.length - 1 ? <span className="rounded-full bg-danger-dot px-2 py-0.5 text-[11px] text-white">NEW</span> : <span />}
                  </Link>
                ))}
                <div className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-dashed border-night-line py-3 pl-4 pr-3 opacity-55">
                  <span className="grid h-[54px] w-[48px] place-items-center rounded text-[15px] font-bold text-night-dim outline-2 outline-dashed outline-night-border">{data.episodes.length + 1}화</span>
                  <span>
                    <b className="block text-[14.5px]">다음 화 준비 중이에요</b>
                    <small className="text-[12px] text-night-dim">곧 우체국에 도착해요</small>
                  </span>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
