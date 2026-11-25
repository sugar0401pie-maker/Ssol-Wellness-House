"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { needsToday, type View } from "@/lib/challenge/state";

// 하단 메뉴 5개(2026-11-25, 요청문 v1.9.4 9-1장): 홈(집 오각형) · 채팅(말풍선) · 갓생러모임(큰 동그라미+체크, 위로 올림) · 고민 타파(편지 봉투) · 마이페이지(머리+어깨).
// 그림 파일 없이 선으로 그린 SVG(24칸). 선택된 메뉴는 노란색+굵게, aria-current="page"(색만으로 구분하지 않게 도형도 다름).
// 갓생러모임: 오늘 저장할 차례인데 아직 안 했으면 오른쪽 위 빨간 점(챌린지 화면이 저장하면 "ssol:challenge" 신호로 다시 확인).
// 메뉴를 숨기는 화면: 고민 타파 글 읽기(/worry/…). 풍등·사운드 배스·이용권은 이 틀 밖의 화면이라 원래 메뉴가 없고, 카드·결과 화면은 메뉴를 덮는다.
const ICON: Record<string, React.ReactNode> = {
  home: <path d="M4 11 L12 4 L20 11 V20 H4 Z" />,
  chat: <path d="M4 5 H20 V16 H11 L7 20 V16 H4 Z" />,
  worry: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="1.5" />
      <path d="M3.5 7 L12 13 L20.5 7" />
    </>
  ),
  my: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20 C6.5 15.8 9 14.5 12 14.5 S17.5 15.8 19 20" />
    </>
  ),
};
const TABS = [
  { href: "/home", label: "홈", icon: "home" },
  { href: "/chat", label: "채팅", icon: "chat" },
  { href: "/challenge", label: "갓생러모임", icon: "challenge" },
  { href: "/worry", label: "고민 타파", icon: "worry" },
  { href: "/mypage", label: "마이페이지", icon: "my" },
];
export const hideNavFor = (pathname: string): boolean => /^\/worry\/.+/.test(pathname);

export default function BottomNav({ getToken = getAccessToken }: { getToken?: () => Promise<string | null> } = {}) {
  const pathname = usePathname();
  const [dot, setDot] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch("/api/challenge", { headers: authHeaders(token), cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { view?: View };
        if (!cancelled && j.view) setDot(needsToday(j.view));
      } catch {
        /* 점 없이 */
      }
    }
    void check();
    const on = () => void check();
    window.addEventListener("ssol:challenge", on);
    return () => {
      cancelled = true;
      window.removeEventListener("ssol:challenge", on);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 한 번 + 신호가 올 때
  }, []);

  if (hideNavFor(pathname)) return null;
  return (
    <nav
      aria-label="메뉴"
      className="relative grid grid-cols-5 items-end rounded-t-[18px] border-t border-night-line bg-[linear-gradient(to_top,rgba(5,14,30,.98),rgba(7,19,40,.95))] px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1"
    >
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        const color = active ? "text-night-yellow font-bold" : "text-night-dim";
        if (t.icon === "challenge") {
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} aria-label={dot ? "갓생러모임, 오늘 인증 전" : "갓생러모임"} className={`flex min-h-11 flex-col items-center text-[10.5px] ${color}`}>
              <span className={`relative -mt-6 grid h-[54px] w-[54px] place-items-center rounded-full border-2 shadow-[0_4px_14px_rgba(0,0,0,.45)] ${active ? "border-night-yellow bg-night-amber" : "border-night-border bg-[#13325e]"}`}>
                <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
                  <path d="M5.5 12.5 L10 17 L18.5 7.5" fill="none" stroke={active ? "var(--night-on-amber)" : "var(--night-text)"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {dot && <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-night-deep bg-danger-dot" aria-hidden="true" />}
              </span>
              <span className="mt-0.5 whitespace-nowrap">갓생러모임</span>
            </Link>
          );
        }
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={`flex min-h-11 flex-col items-center justify-end gap-0.5 pb-0.5 text-[10.5px] ${color}`}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.1 : 1.6} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
              {ICON[t.icon]}
            </svg>
            <span className="whitespace-nowrap">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
