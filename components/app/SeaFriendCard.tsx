"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { pickSeaFriend, type SeaFriendPick } from "@/lib/seaFriends/pick";

// 2026-11-23 대표님 요청: 홈 첫 화면의 디저트 유형 그림·문구("당신은 ○○ 유형이에요")를 "오늘의 바다 친구"로 바꾼다.
// 화면을 열 때마다 20마리 중 하나의 이야기(lib/seaFriends — 동물을 먼저 뽑아 고르게)를 보여 주고, 바로 전에 본 이야기는 다시 안 나온다.
// 바로 전 이야기 id는 이 기기에만 둔다(localStorage — 막혀 있어도 화면은 그대로 동작). 그림은 public/sea-friends(대표님이 준 정사각 그림 v1.1 — 같은 그림은 한 장만, 241장).
const LAST_KEY = "seaFriendLastItem";

function readLast(): string | null {
  try {
    return window.localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}
function writeLast(id: string) {
  try {
    window.localStorage.setItem(LAST_KEY, id);
  } catch {
    // 저장이 막혀 있어도 괜찮다(바로 전 이야기가 다시 나올 수 있을 뿐)
  }
}

function draw(last: string | null, avoidFriendKey: string | null = null): SeaFriendPick {
  const p = pickSeaFriend(last, Math.random, undefined, avoidFriendKey);
  writeLast(p.item.id);
  return p;
}

export default function SeaFriendCard() {
  // 화면이 브라우저에 붙은 뒤에 뽑는다 — 서버가 미리 그린 화면과 무작위 결과가 달라 생기는 깜빡임·경고를 피한다. 그동안은 같은 크기의 빈 칸.
  const [pick, setPick] = useState<SeaFriendPick | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setPick(draw(readLast())), 0);
    return () => window.clearTimeout(id);
  }, []);

  if (!pick) {
    return <section aria-hidden="true" className="mt-4 h-[565px] rounded-2xl bg-navy-soft" />;
  }

  return (
    <section aria-live="polite" className="mt-4 rounded-2xl bg-navy-soft px-4 pb-4 pt-3 text-center">
      <p className="text-[12px] text-slate-500">오늘의 바다 친구</p>
      <div className="relative mx-auto mt-2 aspect-square w-full max-w-[320px] overflow-hidden rounded-2xl bg-white">
        {/* 이미 720px webp(한 장 약 60KB)라 Next 이미지 변환을 거치지 않는다(unoptimized — 그림 241장이 Vercel 이미지 변환 한도를 쓰지 않게). */}
        <Image key={pick.image} src={pick.image} alt={`${pick.friend.name} 그림`} fill unoptimized className="object-cover" />
      </div>
      <p className="mt-3 text-[13px] font-medium text-navy">{pick.friend.name}</p>
      <p className="mt-0.5 font-serif text-[18px] font-bold leading-7 text-foreground">{pick.item.title}</p>
      <p className="mt-2 text-left text-[14px] leading-6 text-slate-600">{pick.item.body}</p>
      <div className="mt-4 flex gap-2">
        <Link href="/chat" className="flex-1 rounded-full bg-navy px-3 py-2.5 text-[13.5px] font-medium text-white">
          오늘 마음은 어때요?
        </Link>
        <button
          type="button"
          onClick={() => setPick(draw(pick.item.id, pick.friend.key))}
          className="flex-1 rounded-full border border-navy bg-white px-3 py-2.5 text-[13.5px] font-medium text-navy active:bg-navy-soft"
        >
          다른 친구 보기
        </button>
      </div>
    </section>
  );
}
