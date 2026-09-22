"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";

type Practice = { title: string; detail: string; category: string; domain: string } | null;
type DailyResponse = { displayName: string | null; dateKey: string; practice: Practice };

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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = await getAccessToken();
      if (!token) {
        if (!cancelled) setError("로그인 정보를 확인하지 못했어요. 새로고침해주세요.");
        return;
      }
      try {
        const res = await fetch("/api/daily-practice", { headers: authHeaders(token) });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as DailyResponse;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("오늘의 제안을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="border-b border-line px-4 py-3">
        <p className="text-[15px] font-medium text-foreground">홈</p>
      </header>

      <div className="flex-1 px-4 py-5">
        <p className="text-[13px] text-slate-400">{data ? formatDateKey(data.dateKey) : " "}</p>
        <p className="mt-1 text-[19px] font-medium leading-7 text-foreground">
          안녕하세요{data?.displayName ? `, ${data.displayName}님` : ""}.
        </p>
        <p className="mt-1 text-[14px] leading-5 text-slate-500">오늘은 이런 작은 변화를 한번 해볼까요?</p>

        {error && <p className="mt-6 text-[13px] text-red-600">{error}</p>}

        {data?.practice && (
          <div className="mt-5 rounded-2xl bg-navy-soft p-4">
            <p className="text-[12px] font-medium text-navy">{data.practice.category}</p>
            <p className="mt-1.5 text-[16px] font-medium leading-6 text-foreground">{data.practice.title}</p>
            <p className="mt-1.5 text-[14px] leading-5 text-slate-600">{data.practice.detail}</p>
          </div>
        )}

        {data && !data.practice && (
          <p className="mt-6 text-[13px] text-slate-400">오늘의 제안을 준비하지 못했어요. 채팅에서 편하게 이야기해보세요.</p>
        )}
      </div>
    </div>
  );
}
