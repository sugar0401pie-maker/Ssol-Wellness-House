"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";

// 홈 맨 위 풍등 배너(2026-11-25, 요청문 v1.9.4 8-2장 배너 ①) — 이벤트 기간이고 아직 안 날렸을 때만 보인다(새해까지 한 번).
// 상태를 못 읽으면 보이지 않는다(홈의 다른 내용을 막지 않게). 배너 바탕은 불투명.
export default function LanternBanner({ getToken = getAccessToken }: { getToken?: () => Promise<string | null> } = {}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch("/api/lantern", { headers: authHeaders(token), cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { open?: boolean; flown?: boolean };
        if (!cancelled) setShow(!!json.open && !json.flown);
      } catch {
        /* 배너 없이 홈만 보인다 */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 열 때 한 번만 읽는다
  }, []);
  if (!show) return null;
  return (
    <Link
      href="/lantern"
      aria-label="풍등 날리기가 시작됐어요. 오늘의 소원을 하늘로 띄워 보내요"
      className="mb-4 flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-[#fdf6e9]"
      style={{
        borderColor: "rgba(255,211,107,.45)",
        background: "linear-gradient(100deg, rgba(243,176,76,.24), rgba(243,176,76,0) 70%), #0d2140",
      }}
    >
      <svg viewBox="0 0 24 30" className="h-8 w-7 flex-none" aria-hidden="true">
        <rect x="7" y="1" width="10" height="3" rx="1" fill="#5b3a1a" />
        <path d="M7 4h10c3 4 5 9 3 18H4C2 13 4 8 7 4Z" fill="#ffd36b" stroke="#8a5a2b" strokeWidth="1.2" />
        <rect x="7" y="22" width="10" height="3" rx="1" fill="#5b3a1a" />
      </svg>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-bold leading-5">풍등 날리기가 시작됐어요</b>
        <small className="mt-0.5 block text-[13px] leading-5 text-[#cfe0f5]">오늘의 소원을 하늘로 띄워 보내요</small>
      </span>
      <span className="text-[20px] leading-none text-[#ffd36b]" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
