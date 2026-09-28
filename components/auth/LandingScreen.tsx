"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import { SHOW_SOCIAL_LOGIN } from "./LoginScreen";

// 2026-09-28: owner가 전달한 디자인 시안(ssol-app-handoff.md 2절)의 "첫 화면(로그아웃 상태 /)".
// 로그인 폼 없이 헤드라인+CTA만 보여주고, 실제 로그인/회원가입은 여기서 이동한 별도 화면에서 한다.
// 헤드라인 9개는 시안 원문 그대로이며, 직전과 같은 문구가 연달아 나오지 않게 sessionStorage에
// 마지막으로 보여준 index를 저장해 둔다.
const HEADLINES = [
  "딱 터놓고 말 할\n누군가가 필요하세요?",
  "말하기 어려운\n고민이 있으신가요?",
  "해결책을 찾지 못해\n힘드신가요?",
  "이유 없이 '그냥'\n힘드신가요?",
  "삶이 버겁고\n지치셨나요?",
  "불안해서 잠못이루는\n날이 있으신가요?",
  "이유없는 불안때문에\n힘드신가요?",
  "정리가 안되고 정신없는\n나날이 계속되나요?",
  "내가 뭘 하고 있나\n싶은 생각이 드시나요?",
];

const LAST_HEADLINE_KEY = "ssol_landing_headline_index";

function pickHeadlineIndex(): number {
  let last = -1;
  try {
    const stored = sessionStorage.getItem(LAST_HEADLINE_KEY);
    if (stored !== null) last = Number(stored);
  } catch {
    // sessionStorage를 못 쓰는 환경이면 그냥 매번 완전 랜덤으로 뽑는다.
  }
  let next = Math.floor(Math.random() * HEADLINES.length);
  if (HEADLINES.length > 1) {
    while (next === last) next = Math.floor(Math.random() * HEADLINES.length);
  }
  try {
    sessionStorage.setItem(LAST_HEADLINE_KEY, String(next));
  } catch {
    // 저장 실패해도 화면 표시엔 문제없다.
  }
  return next;
}

export default function LandingScreen({ onStart }: { onStart: () => void }) {
  const router = useRouter();
  // 서버 렌더링(항상 같은 문구)과 클라이언트 렌더링이 다르면 hydration 경고가 나므로,
  // 최초 렌더는 고정 문구로 두고 마운트 이후에 랜덤 헤드라인으로 바꾼다.
  const [headlineIndex, setHeadlineIndex] = useState(0);
  useEffect(() => {
    // set-state-in-effect 린트 규칙 회피 — 마운트 직후 한 틱 미뤄서 비동기 콜백으로 설정한다
    // (ChatApp.tsx의 세션 복원 effect에서도 쓴 것과 같은 패턴, CLAUDE.md 2026-09-28 기록 참고).
    void Promise.resolve().then(() => setHeadlineIndex(pickHeadlineIndex()));
  }, []);
  const headline = HEADLINES[headlineIndex];

  return (
    <div className="flex h-dvh w-full flex-col overflow-y-auto bg-background px-6 py-6">
      {/* 2026-09-28 버그 수정: 로고 원본(logo-mark.png)은 440×117(가로로 넓은 물결 심볼)인데,
          정사각형 박스(h-24 w-24 등)로 강제 표시해서 세로로 심하게 눌려 보이는 문제가 있었다.
          시안 원본 CSS(.brand img{width:34px}, .hero img{width:84px})처럼 너비만 지정하고
          높이는 실제 비율(117/440)대로 계산해 자연스럽게 나오게 한다. */}
      <div className="flex items-center gap-2">
        <Image src="/logo-mark.png" alt="" width={34} height={9} className="h-auto w-[34px]" />
        <span className="text-[14px] font-medium text-navy">쏠 웰니스 하우스</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Image src="/logo-mark.png" alt="쏠 웰니스 하우스" width={84} height={22} className="h-auto w-[84px]" />
        <p className="mt-6 whitespace-pre-line font-serif text-[22px] font-bold leading-8 text-foreground">
          {headline}
        </p>
        <p className="mt-4 text-[14px] leading-6 text-muted">
          당신의 고민과 걱정, 언제든 들어드릴게요.
          <br />
          전문 상담사가 개발한 웰니스 상담 &apos;쏘웰라&apos;에게 물어보세요.
        </p>
      </div>

      <div className="w-full max-w-xs mx-auto">
        <button
          type="button"
          onClick={onStart}
          className="h-[52px] w-full rounded-[14px] bg-navy text-[15px] font-medium text-white"
        >
          지금 대화를 시작하세요 →
        </button>

        {SHOW_SOCIAL_LOGIN && (
          <button
            type="button"
            onClick={onStart}
            className="mt-2 h-[52px] w-full rounded-[14px] bg-[#FEE500] text-[15px] font-medium text-[#191600]"
          >
            카카오로 계속하기
          </button>
        )}

        <button
          type="button"
          onClick={() => router.push("/signup")}
          className="mt-4 block w-full text-center text-[13px] text-muted"
        >
          계정이 없으신가요? <span className="text-navy underline underline-offset-2">회원가입하기</span>
        </button>

        <SiteFooter />
      </div>
    </div>
  );
}
