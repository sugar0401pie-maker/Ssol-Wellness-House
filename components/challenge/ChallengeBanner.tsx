"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { bannerCopy, type View } from "@/lib/challenge/state";

// 홈 배너 ② 작심삼일 챌린지(2026-11-25, 요청문 v1.9.4 8-2·13-3장) — 이벤트 기간에, 3번을 채우기 전까지. 문구는 챌린지 상태에 따라 바뀐다.
// 상태를 못 읽으면 보이지 않는다. 바탕은 불투명.
export default function ChallengeBanner({ getToken = getAccessToken }: { getToken?: () => Promise<string | null> } = {}) {
  const [copy, setCopy] = useState<{ title: string; desc: string } | null>(null);
  const [href, setHref] = useState("/challenge");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch("/api/challenge", { headers: authHeaders(token), cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { view?: View; eventOpen?: boolean };
        if (!cancelled && j.view && j.eventOpen) {
          setCopy(bannerCopy(j.view));
          // 오늘 인증할 차례면 인증 화면 주소로 바로(대표님 2026-11-25 단계별 주소)
          if (j.view.kind === "todo") setHref(`/challenge/day/${j.view.n}`);
        }
      } catch {
        /* 배너 없이 */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 열 때 한 번
  }, []);
  if (!copy) return null;
  // 2026-11-25 대표님: 배너를 손글씨 그림("쏠 작심삼일 챌린지")으로 교체. 챌린지 상태(오늘은 N일차 등)는 그림 왼쪽 아래에 작게 얹는다.
  return (
    <Link href={href} aria-label={`쏠 작심삼일 챌린지. ${copy.title}. ${copy.desc}`} className="ssol-banner relative mb-4 block overflow-hidden rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,.35)]">
      <Image src="/challenge/banner.webp" alt="" aria-hidden="true" width={1200} height={400} unoptimized priority className="h-auto w-full" />
      <span className="absolute bottom-[7%] left-[5%] max-w-[46%] rounded-full bg-[rgba(8,20,42,.72)] px-2.5 py-1 text-[11.5px] font-bold leading-4 text-night-yellow" aria-hidden="true">
        {copy.title}
      </span>
    </Link>
  );
}
