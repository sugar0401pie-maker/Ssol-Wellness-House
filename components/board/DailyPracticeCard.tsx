"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";

// "오늘 이렇게 해보면 어떨까요?" — 예전엔 홈 탭에 있던 오늘의 제안(/api/daily-practice). 대표님 2026-11-26: 고민 타파 제목 바로 아래로 옮김.
// 불러오지 못하거나 오늘의 제안이 없으면 아무것도 그리지 않는다(고민 타파의 나머지는 그대로).
type Practice = { title: string; detail: string } | null;

export default function DailyPracticeCard() {
  const [practice, setPractice] = useState<Practice>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getAccessToken();
      if (!token) return;
      try {
        const res = await fetch("/api/daily-practice", { headers: authHeaders(token), cache: "no-store" });
        const j = res.ok ? ((await res.json()) as { practice?: Practice }) : null;
        if (!cancelled) setPractice(j?.practice ?? null);
      } catch {
        /* 제안 없이 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  if (!practice) return null;
  return (
    <section className="mx-5 mt-4">
      <p className="text-[15px] font-bold text-night-text">오늘 이렇게 해보면 어떨까요?</p>
      <div className="mt-2 rounded-2xl bg-night-panel p-4">
        <p className="text-[16px] font-medium leading-6 text-night-text">{practice.title}</p>
        <p className="mt-1.5 text-[14px] leading-5 text-night-sub">{practice.detail}</p>
      </div>
    </section>
  );
}
