"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import LoginScreen from "./LoginScreen";
import AppLoading from "@/components/app/AppLoading";
import { savePendingTheme, themeFromLocation } from "@/lib/challenge/pending";

// 2026-09-22: 로그인 없이 쓸 수 있던 익명 로그인 방식을 대체한다. 로그인해야만 앱이 보이고,
// 한 번 로그인하면(이메일/카카오/네이버) Supabase가 세션을 브라우저에 저장해 다음 방문에
// 자동으로 로그인 상태가 유지된다 — 별도로 "기억하기" 로직을 만들 필요가 없다.
//
// 익명 세션(과거 방식 또는 남아있는 캐시)은 "로그인됨"으로 치지 않는다 — Supabase 세션 객체는
// 익명이든 실제 로그인이든 형태가 똑같아서, user.is_anonymous로 구분해야 한다. 그렇지 않으면
// 예전에 남은 익명 세션이 있는 브라우저에서 로그인 화면이 뜨지 않는 문제가 생긴다.
function isRealSession(session: { user?: { is_anonymous?: boolean } } | null): boolean {
  return !!session && session.user?.is_anonymous !== true;
}

export default function AuthGate({
  children,
  initialMode,
}: {
  children: React.ReactNode;
  initialMode?: "signin" | "signup";
}) {
  const [status, setStatus] = useState<"checking" | "loggedOut" | "loggedIn">("checking");

  useEffect(() => {
    const supabase = getBrowserClient();

    // 마운트 시 현재 세션 확인 + 이후 로그인/로그아웃/OAuth 리다이렉트 복귀를 계속 감지.
    async function check() {
      if (!supabase) {
        setStatus("loggedOut");
        return;
      }
      const { data } = await supabase.auth.getSession();
      // 익명 세션은 로그인으로 치지 않고 로그인 화면을 보여 주되, 로그아웃시키지는 않는다(2026-10-10 owner 결정):
      // 쿠키를 함께 쓰는 쏠 아스트로 하우스의 '로그인 없이 테스트하기'(익명 임시 계정)가 쏘웰라에 들르기만 해도
      // 끊기지 않게. 여기서 로그인하면 Supabase가 익명 세션을 실제 세션으로 바꾼다. 서버도 익명 토큰을 거부한다(lib/supabase/auth.ts).
      setStatus(isRealSession(data.session) ? "loggedIn" : "loggedOut");
    }
    void check();

    if (!supabase) return undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(isRealSession(session) ? "loggedIn" : "loggedOut");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 2026-10-15: 세션 확인 중에도 빈 화면 대신 안내 화면(AppLoading).
  if (status === "checking") return <AppLoading fullScreen />;
  if (status === "loggedIn") return <>{children}</>;
  // 2026-11-25: 테스트 결과에서 갓생러모임(/challenge?theme=…)으로 왔는데 로그인 전이면, 그 챌린지를 맡아 두고 로그인하라고 알려 준다.
  const fromTest = typeof window === "undefined" ? null : themeFromLocation();
  if (fromTest) savePendingTheme(fromTest);
  return (
    <>
      {fromTest && (
        <p role="status" className="fixed inset-x-0 top-0 z-40 bg-navy px-4 py-2.5 text-center text-[13.5px] font-medium text-white">
          테스트에서 고른 작심삼일 챌린지를 이어서 하려면 로그인해 주세요.
        </p>
      )}
      <LoginScreen initialMode={initialMode} onLoggedIn={() => setStatus("loggedIn")} />
    </>
  );
}
