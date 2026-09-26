"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import LoginScreen from "./LoginScreen";

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
      if (data.session && !isRealSession(data.session)) {
        // 남아있는 익명 세션은 정리하고 로그인 화면을 보여준다.
        await supabase.auth.signOut();
        setStatus("loggedOut");
        return;
      }
      setStatus(data.session ? "loggedIn" : "loggedOut");
    }
    void check();

    if (!supabase) return undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(isRealSession(session) ? "loggedIn" : "loggedOut");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (status === "checking") return null;
  if (status === "loggedIn") return <>{children}</>;
  return <LoginScreen initialMode={initialMode} onLoggedIn={() => setStatus("loggedIn")} />;
}
