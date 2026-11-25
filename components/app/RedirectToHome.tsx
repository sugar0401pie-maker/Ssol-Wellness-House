"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { safeNext } from "@/lib/auth/authPaths";

// 2026-09-28: /signup에서 가입·로그인이 끝나면(AuthGate가 "로그인됨"으로 판단하면) 홈으로
// 보낸다 — 예전엔 AuthGate의 children으로 AppShell을 통째로 렌더링했지만, 이제 홈/채팅/
// 마이페이지가 "/home", "/chat", "/mypage" 개별 주소로 나뉘어 app/(app)/layout.tsx가 그 셋을
// 감싸므로, /signup 자체는 그 레이아웃 밖이라 그냥 "/home"으로 이동시키는 편이 간단하다.
export default function RedirectToHome() {
  const router = useRouter();
  useEffect(() => {
    // 2026-11-25: 로그인이 필요한 화면에서 /login?next=…로 왔으면 그 화면으로 돌아간다(이 사이트 안의 경로만).
    let next: string | null = null;
    try {
      next = safeNext(new URLSearchParams(window.location.search).get("next"));
    } catch {
      next = null;
    }
    router.replace(next ?? "/home");
  }, [router]);
  return null;
}
