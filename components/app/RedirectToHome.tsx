"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 2026-09-28: /signup에서 가입·로그인이 끝나면(AuthGate가 "로그인됨"으로 판단하면) 홈으로
// 보낸다 — 예전엔 AuthGate의 children으로 AppShell을 통째로 렌더링했지만, 이제 홈/채팅/
// 마이페이지가 "/", "/chat", "/mypage" 개별 주소로 나뉘어 app/(app)/layout.tsx가 그 셋을
// 감싸므로, /signup 자체는 그 레이아웃 밖이라 그냥 "/"로 이동시키는 편이 간단하다.
export default function RedirectToHome() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
