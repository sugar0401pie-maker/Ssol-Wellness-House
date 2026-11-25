"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { bootstrap } from "@/lib/app/bootstrapClient";
import SiteFooter from "@/components/SiteFooter";
import SeaFriendCard from "@/components/app/SeaFriendCard";
import LanternBanner from "@/components/lantern/LanternBanner";
import ChallengeBanner from "@/components/challenge/ChallengeBanner";
import SkyDecor from "@/components/app/SkyDecor";

type Practice = { title: string; detail: string; category: string; domain: string } | null;
type Character = { code: string; name: string | null; tagline: string | null; hasResult: boolean };
type DailyResponse = {
  displayName: string | null;
  dateKey: string;
  greeting: string;
  practice: Practice;
  character: Character;
};

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function formatDateKey(dateKey: string): string {
  // dateKey는 "YYYY-MM-DD"(KST 기준). 표시용으로만 요일을 계산한다.
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}월 ${d}일 ${WEEKDAY[dt.getDay()]}요일`;
}

export default function HomeTab() {
  const [data, setData] = useState<DailyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 2026-09-26: 테스트를 새로 마치고 돌아오면 캐릭터도 바로 바뀌도록 창이 다시 보일 때 재조회한다.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      // 2026-10-16(앱 첫 로딩 속도 개선): 앱을 열 때 미리 출발시켜 둔 홈 데이터가 있으면(온보딩을 이미 마친 사용자만) 그 결과를 쓴다.
      // 한 번만 쓰이고(가져가면 비워짐), 없거나 실패하면 아래처럼 평소대로 직접 요청한다. 창이 다시 보일 때의 재조회는 항상 직접 요청한다.
      const pre = bootstrap.takeDaily<DailyResponse>();
      if (pre) {
        const json = await pre;
        if (json) {
          if (!cancelled) {
            setData(json);
            setError(null);
          }
          return;
        }
      }
      const token = await getAccessToken();
      if (!token) {
        if (!cancelled) setError("로그인 정보를 확인하지 못했어요. 새로고침해주세요.");
        return;
      }
      try {
        const res = await fetch("/api/daily-practice", { headers: authHeaders(token), cache: "no-store" });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as DailyResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("오늘의 제안을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      }
    }
    void load();
    function onVisible() {
      if (document.visibilityState === "visible") void load();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return (
    // 2026-11-25: 그림 있는 화면이라 밤하늘 배경에 달·별(요청문 12장). 내용은 달·별 위에 놓는다.
    <div className="ssol-sky ssol-home relative flex h-full flex-col overflow-y-auto">
      <SkyDecor />
      <header className="relative border-b border-line px-4 py-3">
        <p className="text-[15px] font-medium text-foreground">홈</p>
      </header>

      <div className="relative flex-1 px-4 py-5">
        {/* 2026-11-25(요청문 v1.9.4 8-2장): 맨 위 배너 2개 — ① 풍등(기간 중·아직 안 날림) ② 작심삼일 챌린지(기간 중·3번 채우기 전) */}
        <LanternBanner />
        <ChallengeBanner />
        <p className="text-[13px] text-slate-400">{data ? formatDateKey(data.dateKey) : " "}</p>
        {/* 2026-09-28 버그 수정: 시안의 홈 인사말은 .h-title(Gowun Batang 서체, 24px)인데
            여기만 제목 서체가 빠져 있어서 "홈이 하나도 안 바뀌었다"는 지적을 받았다 — 다른
            화면 제목(로그인/회원가입 등)과 같은 font-serif를 적용한다. */}
        <p className="mt-1 font-serif text-[22px] font-bold leading-7 text-foreground">
          안녕하세요{data?.displayName ? `, ${data.displayName}님` : ""}!
        </p>
        <p className="mt-1 text-[14px] leading-5 text-slate-500">{data?.greeting ?? " "}</p>

        {/* 2026-11-23 대표님 요청: 디저트 유형 그림·문구("당신은 ○○ 유형이에요") 대신 "오늘의 바다 친구"(그림 + 이야기, 열 때마다 무작위).
            홈 데이터를 기다리지 않고 바로 보인다(서버 데이터가 필요 없음). */}
        <SeaFriendCard />

        {/* 2026-10-15 owner 요청: 홈 데이터(캐릭터·오늘의 제안)를 불러오는 동안 빈 칸 대신 안내를 보여준다. */}
        {!data && !error && (
          <div role="status" aria-live="polite" className="mt-10 flex flex-col items-center text-center">
            <p className="text-[14px] leading-6 text-slate-600">
              <span className="ssol-pulse-text">오늘의 제안을 불러오고 있어요</span>
            </p>
            <p className="mt-1 text-[12px] leading-5 text-slate-400">
              <span className="ssol-pulse-text" style={{ animationDelay: "200ms" }}>
                잠시만 기다려 주세요.
              </span>
            </p>
            <p className="mt-3 text-[20px] leading-none text-navy" aria-hidden="true">
              <span className="ssol-thinking-dot" style={{ animationDelay: "0ms" }}>
                ·
              </span>
              <span className="ssol-thinking-dot" style={{ animationDelay: "150ms" }}>
                ·
              </span>
              <span className="ssol-thinking-dot" style={{ animationDelay: "300ms" }}>
                ·
              </span>
            </p>
          </div>
        )}

        {error && <p className="mt-6 text-[13px] text-red-600">{error}</p>}

        {data?.practice && (
          <>
            <p className="mt-6 text-[14px] font-medium text-foreground">오늘 이렇게 해보면 어떨까요?</p>
            <div className="mt-2 rounded-2xl bg-navy-soft p-4">
              <p className="text-[16px] font-medium leading-6 text-foreground">{data.practice.title}</p>
              <p className="mt-1.5 text-[14px] leading-5 text-slate-600">{data.practice.detail}</p>
            </div>
          </>
        )}

        {data && !data.practice && (
          <p className="mt-6 text-[13px] text-slate-400">오늘의 제안을 준비하지 못했어요. 채팅에서 편하게 이야기해보세요.</p>
        )}
      </div>

      {/* 2026-11-03 owner 요청: 로그인 뒤 화면 하단에도 사업자 정보(통신판매업신고번호 포함). 채팅은 입력창이 고정이라 제외. */}
      <div className="px-4 pb-6">
        <SiteFooter />
      </div>
    </div>
  );
}
