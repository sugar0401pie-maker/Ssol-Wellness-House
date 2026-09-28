"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import OnboardingFlow from "./OnboardingFlow";
import { signOut } from "@/lib/supabase/authClient";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";

// 2026-09-28: owner 요청으로 홈/채팅/마이페이지를 "/", "/chat", "/mypage" 개별 주소로
// 분리했다(예전엔 AppShell.tsx가 세 탭을 전부 마운트해두고 CSS로만 보이기/숨기기 — 그래서
// 홈 화면 하나 보여주려고 채팅·마이페이지 코드까지 한꺼번에 받아와 첫 로딩이 무거웠다).
// 이 컴포넌트(AppFrame)는 세 페이지가 공유하는 헤더·하단 탭바·온보딩 게이트를 담당하고,
// app/(app)/layout.tsx에 한 번만 마운트돼 탭을 오가도 다시 그려지지 않는다 — 헤더 깜빡임이나
// 온보딩 재확인 없이, 각 탭의 실제 내용(page.tsx)만 필요할 때 불러와 가벼워진다.
//
// 대신 탭 전환은 실제 페이지 이동이라 채팅 화면(components/chat/ChatApp.tsx)은 페이지를
// 벗어나면 언마운트된다 — "탭 바꿔도 대화 안 사라지게" 하려고 ChatApp이 활성 세션 id를
// localStorage에 저장해두고 다시 마운트될 때 그 대화를 자동으로 불러오는 방식으로 바꿨다.
const TABS = [
  { href: "/", label: "홈" },
  { href: "/chat", label: "채팅" },
  { href: "/mypage", label: "마이페이지" },
];

type OnboardingInfo = {
  completed: boolean;
  nickname: string | null;
  title: string;
};

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // 2026-09-24: 로그인 후 "자기소개" 온보딩을 반드시 먼저 마치도록 한다 — 안 했으면 이
  // 모달이 화면 전체를 덮어서, 어느 탭으로도 못 빠져나가고 반드시 답해야 한다.
  const [onboarding, setOnboarding] = useState<OnboardingInfo | "loading" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const token = await getAccessToken();
      if (!token) {
        if (!cancelled) setOnboarding("error");
        return;
      }
      try {
        const res = await fetch("/api/onboarding", { headers: authHeaders(token) });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as OnboardingInfo;
        if (!cancelled) setOnboarding(json);
      } catch {
        if (!cancelled) setOnboarding("error"); // 확인 자체가 실패하면 안전하게 막지 않고 그냥 넘어간다
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const needsOnboarding = typeof onboarding === "object" && !onboarding.completed;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-white shadow-sm sm:border-x sm:border-line">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        {/* 2026-09-28: 디자인 시안 적용 — 흰 박스 로고(logo.jpg) 대신 투명 배경 물결 심볼 사용. */}
        <div className="flex items-center gap-1.5">
          <Image src="/logo-mark.png" alt="" width={22} height={22} className="h-[22px] w-[22px]" />
          <span className="text-[14px] font-medium text-navy">쏠 웰니스 하우스</span>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-[12px] text-slate-400 underline underline-offset-2"
        >
          로그아웃
        </button>
      </div>

      {/* 2026-09-24 버그 수정: 온보딩 확인이 끝나기 전에 탭 내용을 먼저 그리면, 홈 탭이
          온보딩 답변이 저장되기도 전에 "오늘의 실천방법"을 먼저 불러와 버리고, 온보딩 완료
          후에도 다시 안 불러와서 개인화가 반영 안 된 채로 남는 문제가 있었다. 온보딩 확인이
          끝난 뒤에만(로딩 아닐 때) 내용을 그린다 — 보통 아주 짧은 지연이라 체감되지 않는다. */}
      {onboarding !== "loading" && !needsOnboarding && <div className="min-h-0 flex-1 overflow-hidden">{children}</div>}

      <nav className="grid grid-cols-3 border-t border-line bg-white pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`py-1.5 text-center text-[13px] font-medium ${pathname === t.href ? "text-navy" : "text-slate-400"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {needsOnboarding && typeof onboarding === "object" && (
        <OnboardingFlow
          mode="gate"
          nickname={onboarding.nickname}
          title={onboarding.title}
          onDone={() => setOnboarding({ ...onboarding, completed: true })}
        />
      )}
    </div>
  );
}
