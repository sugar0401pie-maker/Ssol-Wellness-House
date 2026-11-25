"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { bannerCopy, type View } from "@/lib/challenge/state";

// 홈 배너 ② 작심삼일 챌린지(2026-11-25, 요청문 v1.9.4 8-2·13-3장) — 이벤트 기간에, 3번을 채우기 전까지. 문구는 챌린지 상태에 따라 바뀐다.
// 상태를 못 읽으면 보이지 않는다. 바탕은 불투명.
export default function ChallengeBanner({ getToken = getAccessToken }: { getToken?: () => Promise<string | null> } = {}) {
  const [copy, setCopy] = useState<{ title: string; desc: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch("/api/challenge", { headers: authHeaders(token), cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { view?: View; eventOpen?: boolean };
        if (!cancelled && j.view && j.eventOpen) setCopy(bannerCopy(j.view));
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
  return (
    <Link
      href="/challenge"
      aria-label={`${copy.title}. ${copy.desc}`}
      className="mb-4 flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-[#fdf6e9]"
      style={{ borderColor: "rgba(143,188,235,.5)", background: "linear-gradient(100deg, rgba(91,121,166,.45), rgba(91,121,166,0) 70%), #0d2140" }}
    >
      <svg viewBox="0 0 24 24" className="h-8 w-8 flex-none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="#f3b04c" />
        <path d="M6.5 12.5 L10.5 16.5 L17.5 8" fill="none" stroke="#3b2208" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-bold leading-5">{copy.title}</b>
        <small className="mt-0.5 block text-[13px] leading-5 text-[#cfe0f5]">{copy.desc}</small>
      </span>
      <span className="text-[20px] leading-none text-[#8fbceb]" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
