"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BASIS_SUB,
  CLOUD_MAX,
  POST_INTRO_IMAGE,
  scoreOf,
  type Basis,
  type Episode,
  type Guide,
} from "@/lib/board/data";
import { CLOUD_H, CLOUD_W, boldFor, colorFor, layoutCloud } from "@/lib/board/cloud";
import { mainTags } from "@/lib/board/tags";

// 고민 타파 본문(요청문 v1.9.4 10장) — 앱 안(/worry)과 로그인 없이 보는 공개 게시판(/board)이 같은 화면을 쓴다(대표님 2026-11-25).
// 고민우체국 연재(맨 위, 대표님 2026-11-26) → 해시태그 글자 구름(가까운 고민이 크게, 천천히 떠다님) → 고른 고민 패널(이름표·제목·먼저 한 줄로 3줄·글 읽기).
// basePath: 글 읽기 주소의 앞부분(/worry 또는 /board). 감싸는 쪽에 container-type: inline-size가 있어야 글자 구름 크기(cqw)가 맞는다.
export default function BoardView({
  guides,
  episodes,
  upcoming = [],
  basis,
  basePath,
}: {
  guides: Guide[];
  episodes: Episode[];
  upcoming?: { n: number; title: string; tag: string; publishAt: string }[];
  basis: Basis;
  basePath: string;
}) {
  const [sel, setSel] = useState<string | null>(null);
  // 점수가 높은 순서로(Tab 순서도 같다), 한 번에 최대 12개.
  const items = useMemo(
    () =>
      guides
        .map((g, i) => ({ g, i, score: scoreOf(basis, g.tag) }))
        .sort((a, b) => b.score - a.score || a.i - b.i)
        .slice(0, CLOUD_MAX),
    [guides, basis],
  );
  const pos = useMemo(
    () =>
      layoutCloud(
        items.map((x) => ({
          key: x.g.slug,
          label: `#${x.g.tag}`,
          score: x.score,
        })),
        CLOUD_W,
        CLOUD_H,
      ),
    [items],
  );
  const selected =
    items.find((x) => x.g.slug === sel)?.g ?? items[0]?.g ?? null;

  return (
    <>
      {/* 대표님 2026-11-26: 고민우체국을 맨 위로, 그 아래 고민 글자 구름 */}
      <section className="mx-5 mt-4">
        <div className="flex items-center gap-3">
          <Image
            src={POST_INTRO_IMAGE}
            alt="편지를 여는 해달 우체부"
            width={72}
            height={72}
            unoptimized
            className="h-[72px] w-[72px] flex-none rounded-2xl object-cover"
          />
          <div>
            <h2 className="text-[19px] font-bold">고민우체국</h2>
            <p className="mt-0.5 break-keep text-[12.5px] leading-5 text-night-sub">
              {/* 대표님 2026-11-25 문구 */}
              일상의 고민을 받아서 답변해드려요.
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-2">
          {episodes.map((e, i) => (
            <Link
              key={e.n}
              href={`${basePath}/post/${e.n}`}
              className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-night-line bg-night-panel py-3 pl-4 pr-3"
            >
              {/* 대표님 2026-11-26: 열린 회차의 우표 안에 그 회차 캐릭터 그림(표지 image), 회차 번호는 우표 아래쪽에 작게. 그림이 없으면 예전처럼 번호만 */}
              {e.image ? (
                <span className="relative block h-[54px] w-[48px] rotate-[-3deg] overflow-hidden rounded bg-[#f6e3b4] outline-2 outline-offset-2 outline-dashed outline-[#f6e3b4]">
                  <Image src={e.image} alt="" aria-hidden="true" fill sizes="48px" unoptimized className="object-cover object-top" />
                  <span className="absolute inset-x-0 bottom-0 bg-[rgba(246,227,180,.92)] text-center text-[10.5px] font-bold leading-[15px] text-night-on-amber">{e.n}화</span>
                </span>
              ) : (
                <span className="grid h-[54px] w-[48px] rotate-[-3deg] place-items-center rounded bg-[#f6e3b4] text-[15px] font-bold text-night-on-amber outline-2 outline-offset-2 outline-dashed outline-[#f6e3b4]">
                  {e.n}화
                </span>
              )}
              <span className="min-w-0">
                <b className="block text-[14.5px] leading-snug">{e.title}</b>
                {/* 주요 태그 5개(대표님 2026-11-25) — 글만의 태그가 없으면 원래 분류 하나 */}
                <small className="mt-0.5 block break-keep text-[12px] leading-5 text-night-dim">
                  {(e.tags?.length ? mainTags(e.tags) : [e.tag]).map((t) => `#${t}`).join(" ")}
                </small>
              </span>
              {i === episodes.length - 1 ? (
                <span className="rounded-full bg-danger-dot px-2 py-0.5 text-[11px] text-night-text">
                  NEW
                </span>
              ) : (
                <span />
              )}
            </Link>
          ))}
          {/* 예약 회차는 반투명하게 미리 — 누를 수 없고 공개 날짜를 알려 준다(대표님 2026-11-25). 없으면 "다음 화 준비 중" */}
          {upcoming.map((u) => (
            <div
              key={u.n}
              aria-disabled="true"
              className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-dashed border-night-line py-3 pl-4 pr-3 opacity-50"
            >
              <span className="grid h-[54px] w-[48px] place-items-center rounded text-[15px] font-bold text-night-dim outline-2 outline-dashed outline-night-border">
                {u.n}화
              </span>
              <span className="min-w-0">
                <b className="block text-[14.5px] leading-snug">{u.title}</b>
                <small className="text-[12px] text-night-yellow">
                  {+u.publishAt.slice(5, 7)}월 {+u.publishAt.slice(8, 10)}일
                  공개 예정이에요
                </small>
              </span>
            </div>
          ))}
          {upcoming.length === 0 && (
            <div className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-dashed border-night-line py-3 pl-4 pr-3 opacity-55">
              <span className="grid h-[54px] w-[48px] place-items-center rounded text-[15px] font-bold text-night-dim outline-2 outline-dashed outline-night-border">
                {episodes.length + 1}화
              </span>
              <span>
                <b className="block text-[14.5px]">다음 화 준비 중이에요</b>
                <small className="text-[12px] text-night-dim">
                  곧 우체국에 도착해요
                </small>
              </span>
            </div>
          )}
        </div>
      </section>
      {/* 글자 구름 설명(예전엔 맨 위 제목 아래) — 구름 바로 위로(대표님 2026-11-26 순서: 고민우체국 → 글자 구름) */}
      <p className="mx-5 mt-8 break-keep text-[13px] leading-5 text-night-sub">{BASIS_SUB[basis]}</p>
      <div
        role="group"
        aria-label="요즘 많이 나오는 고민"
        className="relative mx-auto mt-3 overflow-hidden rounded-[7cqw]"
        style={{
          width: `${CLOUD_W}cqw`,
          height: `${CLOUD_H}cqw`, // 대표님 2026-11-26: 세로 줄임(66 → 44)
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(91,121,166,.28), rgba(8,20,42,.35) 70%)",
        }}
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
                style={{
                  ["--dx" as string]: `${(0.7 + ((k * 37) % 10) / 8).toFixed(2)}cqw`,
                  ["--dy" as string]: `${(0.6 + ((k * 53) % 10) / 9).toFixed(2)}cqw`,
                  ["--d" as string]: `${(4.5 + ((k * 29) % 10) / 3).toFixed(1)}s`,
                  ["--dl" as string]: `-${(((k * 13) % 7) * 0.9).toFixed(1)}s`,
                }}
              >
                #{g.tag}
              </span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div
          className="mx-5 mt-3 rounded-2xl border border-night-line bg-night-panel p-4"
          aria-live="polite"
        >
          <p className="text-[12.5px] text-night-amber">
            #{selected.tag} · 고민 가이드
          </p>
          <p className="mt-1 text-[16.5px] font-bold leading-snug">
            {selected.title}
          </p>
          <ol className="mt-2 list-decimal pl-5 text-[13.5px] leading-6 text-night-sub">
            {selected.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ol>
          <Link
            href={`${basePath}/guide/${selected.slug}`}
            className="mt-3 block rounded-full bg-night-amber py-2.5 text-center text-[15px] font-bold text-night-on-amber"
          >
            글 읽기
          </Link>
        </div>
      )}

    </>
  );
}
