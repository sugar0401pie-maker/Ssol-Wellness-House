"use client";

import { useState } from "react";
import Image from "next/image";
import ChatApp from "@/components/chat/ChatApp";
import HomeTab from "./HomeTab";
import MyPageTab from "./MyPageTab";
import { signOut } from "@/lib/supabase/authClient";

// 2026-09-22: 로그인 이후 화면을 홈/채팅/마이페이지 3파트로 분리. 탭을 바꿔도 채팅 대화가
// 초기화되지 않도록 세 탭을 전부 마운트해두고 CSS로만 보이기/숨기기를 전환한다
// (조건부 렌더링으로 언마운트하면 채팅 메시지·세션이 날아간다).
type Tab = "home" | "chat" | "mypage";

const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "홈" },
  { id: "chat", label: "채팅" },
  { id: "mypage", label: "마이페이지" },
];

export default function AppShell() {
  const [tab, setTab] = useState<Tab>("home");

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-white shadow-sm sm:border-x sm:border-line">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <Image src="/logo.jpg" alt="쏠 웰니스 하우스" width={832} height={180} priority className="h-7 w-auto" />
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-[12px] text-slate-400 underline underline-offset-2"
        >
          로그아웃
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <div className={tab === "home" ? "h-full" : "hidden"}>
          <HomeTab />
        </div>
        <div className={tab === "chat" ? "h-full" : "hidden"}>
          <ChatApp />
        </div>
        <div className={tab === "mypage" ? "h-full" : "hidden"}>
          <MyPageTab />
        </div>
      </div>

      <nav className="grid grid-cols-3 border-t border-line bg-white pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`py-1.5 text-[13px] font-medium ${tab === t.id ? "text-navy" : "text-slate-400"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
