"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OnboardingFlow from "./OnboardingFlow";
import { QUESTIONS } from "@/lib/onboarding/schema";
import { onboardingStepPath } from "@/lib/onboarding/stepPath";
import { safeNext } from "@/lib/auth/authPaths";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";

// 온보딩을 자기 주소의 페이지로(대표님 2026-11-25 "화면 바꾸면 무조건 링크 나눠"). 질문을 넘기면 주소만 바꾼다(다시 그리지 않음 — 답이 그대로 남는다).
// 끝내거나 닫으면 ?back=의 화면(없으면 마이페이지)으로.
export default function OnboardingPage({ step }: { step: number }) {
  const router = useRouter();
  const [nickname, setNickname] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getAccessToken();
      if (!token) return;
      try {
        const res = await fetch("/api/onboarding", { headers: authHeaders(token) });
        const j = res.ok ? ((await res.json()) as { nickname?: string | null }) : null;
        if (!cancelled) setNickname(j?.nickname ?? null);
      } catch {
        /* 이름 없이 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const onStepChange = useCallback((i: number) => {
    try {
      const path = onboardingStepPath(i, QUESTIONS.length);
      if (window.location.pathname !== path) window.history.replaceState(window.history.state, "", path + window.location.search);
    } catch {
      /* 무시 */
    }
  }, []);
  const leave = () => {
    let back: string | null = null;
    try {
      back = safeNext(new URLSearchParams(window.location.search).get("back"));
    } catch {
      back = null;
    }
    router.push(back ?? "/mypage");
  };
  return <OnboardingFlow mode="edit" nickname={nickname} initialStep={step} onStepChange={onStepChange} onDone={leave} onClose={leave} />;
}
