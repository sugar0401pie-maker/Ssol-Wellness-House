"use client";

import Image from "next/image";
import Link from "next/link";
import { gaegu } from "@/lib/fonts/gaegu";
import { loadThumb } from "@/lib/challenge/photos";
import { shortDate, type Challenge } from "@/lib/challenge/state";
import SkyDecor from "@/components/app/SkyDecor";

// 갓생러모임 페이지들이 같이 쓰는 조각: 밤하늘 바탕 틀 · 위쪽 그림 · 도장 3칸 · 기록 목록.

export function ChallengeShell({
  back,
  children,
}: {
  back?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-full overflow-y-auto ssol-sky text-night-text">
      <SkyDecor moon={false} />
      {/* 글꼴 클래스를 한 번 써 둬야 카드에 쓸 손글씨 글꼴 정의가 페이지에 실린다 */}
      <span className={`${gaegu.className} sr-only`} aria-hidden="true">
        쏠
      </span>
      {back && (
        <div className="relative px-3 pt-3">
          <Link
            href={back.href}
            className="inline-flex min-h-11 items-center gap-1 px-2 text-[14px] text-night-soft"
          >
            <span aria-hidden="true">‹</span> {back.label}
          </Link>
        </div>
      )}
      {children}
    </div>
  );
}

export function ChallengeHero({ small }: { small?: boolean }) {
  return (
    <>
      {/* 대표님 2026-11-25: 그림 안에 달이 있어 배경 달은 숨기고(ChallengeShell) 그림을 화면 폭만큼 키움 */}
      {/* 대표님 2026-11-25: 제목 자리에 손글씨 그림("쏠 작심삼일 챌린지" 글자가 그림 안 — 제목은 화면 읽기용으로만) */}
      <h1 className="sr-only">쏠 작심삼일 챌린지</h1>
      <Image
        src="/challenge/hero.webp"
        alt=""
        aria-hidden="true"
        width={800}
        height={800}
        priority
        unoptimized
        className={`mx-auto h-auto rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,.35)] ${small ? "w-[64%]" : "w-full"}`}
      />
    </>
  );
}

export function Stamps({
  c,
  stamped,
  dim,
}: {
  c: Challenge | null;
  stamped: number;
  dim: boolean;
}) {
  return (
    <div
      className={`mt-3 flex justify-center gap-4 ${dim ? "opacity-55" : ""}`}
      aria-label={`도장 ${stamped}개`}
    >
      {[1, 2, 3].map((d) => {
        const on = d <= stamped;
        const ck = c?.checkins.find((x) => x.n === d);
        return (
          <div
            key={d}
            className="w-[60px] text-center text-[12.5px] text-night-sub"
          >
            <div
              className={`mx-auto mb-1 grid h-[60px] w-[60px] place-items-center rounded-full text-[19px] font-bold ${on ? "bg-night-amber text-night-on-amber" : "border-2 border-dashed border-night-border text-night-dim"}`}
            >
              {on ? (
                <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
                  <path
                    d="M5.5 12.5 L10 17 L18.5 7.5"
                    fill="none"
                    stroke="var(--night-on-amber)"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                d
              )}
            </div>
            {d}일차
            {ck && (
              <span className="block text-[11px] text-night-dim">
                {shortDate(ck.day)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function HistoryRows({ c }: { c: Challenge }) {
  return (
    <ul className="grid gap-2">
      {c.checkins.map((ck) => {
        const thumb = loadThumb(c.id, ck.n);
        return (
          <li
            key={ck.n}
            className="flex items-center gap-3 rounded-xl bg-night-panel p-2"
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element -- 이 기기에 둔 작은 사진(data 주소)
              <img
                src={thumb}
                alt={`${ck.n}일차 사진`}
                className="h-12 w-12 flex-none rounded-lg object-cover"
              />
            ) : (
              <span className="grid h-12 w-12 flex-none place-items-center rounded-lg bg-[rgba(243,176,76,.18)] text-[12px] text-night-amber">
                {ck.n}일
              </span>
            )}
            <span className="min-w-0 text-[13px] leading-5">
              <span className="text-night-amber">
                {ck.n}일차 · {shortDate(ck.day)}
              </span>
              {/* 이용자 메모는 글자 그대로(HTML로 해석하지 않음 — React가 그대로 넣는다) */}
              <span className="block truncate text-night-soft">
                {ck.memo || ck.action}
              </span>
            </span>
          </li>
        );
      })}
      {c.checkins.length >= 3 && (
        <li className="rounded-xl bg-[rgba(243,176,76,.12)] px-3 py-2 text-[13px] text-night-yellow">
          3일차 챌린지 완료{" "}
          <span className="text-night-soft">/ 3일을 모두 채웠어요</span>
        </li>
      )}
    </ul>
  );
}

export function Loading({ error }: { error: string | null }) {
  return error ? (
    <p className="mt-8 text-center text-[14px] text-night-yellow">{error}</p>
  ) : (
    <p className="mt-8 text-center text-[14px] text-night-dim">불러오는 중…</p>
  );
}

// 화면 아래에 붙는 큰 버튼 자리
export function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 bg-[linear-gradient(to_top,rgba(13,36,70,.98)_70%,rgba(13,36,70,0))] px-5 pb-3 pt-4">
      {children}
    </div>
  );
}

export const bigBtn =
  "block w-full rounded-full bg-night-amber py-3 text-center text-[17px] font-bold text-night-on-amber disabled:bg-night-disabled disabled:text-night-disabled-text";
