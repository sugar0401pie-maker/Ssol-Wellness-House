"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";

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
        <p className="mt-1 text-[14px] leading-5 text-slate-500">{data?.greeting ?? " "}</p>

        {data?.character && (
          <div className="mt-4 flex flex-col items-center">
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={`/characters/${data.character.code}.png`}
                alt={data.character.name ?? "웰니스 캐릭터"}
                fill
                className={`object-contain ${data.character.hasResult ? "" : "opacity-40"}`}
                priority={false}
              />
            </div>
            {data.character.hasResult && data.character.name ? (
              <p className="mt-2 px-2 text-center text-[14px] leading-6 text-foreground">
                {data.displayName ? `${data.displayName}님은 ` : ""}
                <span className="font-medium text-navy">{data.character.name}</span> 유형이에요.
                {data.character.tagline && <span className="mt-0.5 block text-slate-500">{data.character.tagline}</span>}
              </p>
            ) : (
              <p className="mt-2 text-center text-[12px] leading-4 text-slate-400">
                아직 심리테스트 결과가 없어서 랜덤 캐릭터예요.
                <br />
                테스트하면 내 캐릭터를 만날 수 있어요.
              </p>
            )}
          </div>
        )}

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
