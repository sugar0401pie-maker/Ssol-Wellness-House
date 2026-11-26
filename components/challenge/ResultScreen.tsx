"use client";

import Image from "next/image";
import Link from "next/link";
import { resultLine } from "@/lib/challenge/state";
import { rewardGrantedLine } from "@/lib/challenge/reward";
import { EVENT_ACCOUNT } from "./CardScreen";

// 결과 화면 "오늘 챌린지를 완료했어요~!!"(요청문 13-9장, 대표님 2026-11-25: 결과 화면에도 그림). 하단 메뉴를 가리는 전체 화면.
export default function ResultScreen({ n, art, reward }: { n: number; art: string; reward?: { granted: boolean; expiresAt: string | null } | null }) {
  return (
    <div className="ssol-sky fixed inset-0 z-[60] overflow-y-auto text-night-text">
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 px-8 py-10 text-center">
        <div className="relative">
          <Image
            src={art}
            alt="함께 기뻐하는 바다 친구"
            width={200}
            height={200}
            unoptimized
            className="h-[180px] w-[180px] rounded-3xl object-cover shadow-[0_10px_30px_rgba(0,0,0,.4)]"
          />
          <div
            className="absolute -bottom-3 -right-3 grid h-16 w-16 place-items-center rounded-full bg-night-amber"
            style={{ animation: "ssol-stamp-pop .45s ease-out both" }}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" className="h-9 w-9">
              <path
                d="M5.5 12.5 L10 17 L18.5 7.5"
                fill="none"
                stroke="var(--night-on-amber)"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <h1 className="mt-2 text-[23px] font-bold leading-snug">
          오늘 챌린지를 완료했어요~!!
        </h1>
        <p className="text-[16px] text-night-yellow">{resultLine(n)}</p>
        {reward?.granted && (
          <p className="break-keep rounded-2xl bg-night-panel px-4 py-3 text-[14.5px] leading-snug text-night-text">
            {rewardGrantedLine(reward.expiresAt)}
          </p>
        )}
        <p className="break-keep text-[12.5px] leading-5 text-night-dim">
          스토리에 {EVENT_ACCOUNT} 계정을 태그하고 공개 계정으로 올리면 추첨
          대상이에요. 올렸는지는 운영에서 확인해요.
        </p>
        <div className="mt-2 grid w-full gap-2">
          <Link
            href="/challenge"
            className="rounded-full bg-night-amber py-3 text-[16px] font-bold text-night-on-amber"
          >
            갓생러모임으로
          </Link>
          <Link
            href="/home"
            className="rounded-full border border-night-border py-3 text-[15px]"
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
