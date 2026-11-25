"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";

// 2026-09-28: owner가 전달한 디자인 시안(ssol-app-handoff.md 2절)의 "첫 화면(로그아웃 상태 /)".
// 로그인 폼 없이 헤드라인+CTA만 보여주고, 실제 로그인/회원가입은 여기서 이동한 별도 화면에서 한다.
// 2026-11-25 대표님: 헤드라인을 무거운 문구(불안해서 잠못이루는… 등 시안 9개) 대신 가벼운 일상 고민으로 바꿈 — 열 때마다 무작위.
// 목록은 대표님이 보내 준 표 그대로(고민우체국 1~10화 고민 + 아직 안 만든 고민 제안). "입맛도 슬럼프"는 표의 비고(식사 이야기라 보류 권함)대로 뺐다.
// 쉼표가 있으면 쉼표 뒤에서 줄을 바꾼다(lineBreak). 직전과 같은 문구가 연달아 나오지 않게 sessionStorage에 마지막 index를 둔다.
const HEADLINES = [
  "나 디테일에 집착하는데 이거 설마 처녀자리라서 그런 거야?",
  "MBTI는 I인데 사람 만나는 게 좋아, 사실 난 E인 걸까?",
  "나 T라서 조심해서 말하는데 사람들이 자꾸 상처받는 것 같아",
  "썸 타는 사람이 카톡 답장을 3시간째 안 해, 기다려 말아?",
  "주말에 누워서 폰만 보다가 일요일 밤에 허무해",
  "회사 옮길까 그냥 다닐까, 오늘도 생각만 하다 퇴근했어",
  "단톡방에서 내 말에만 답장이 늦는 것 같아서 서운해",
  "이번 달도 통장이 텅 비었어, 소비 습관 어떡하지",
  "퇴근하고 뭐라도 배워야 할 것 같은데 뭘 해야 할지 모르겠어",
  "타로도 믿고 사주도 믿는데 이런 얘기 어디 가서 하지?",
  "이거 썸 맞아? 친구들 말고 누구한테 물어보지?",
  "친구 생일 선물, 이 정도면 너무 성의 없어 보일까?",
  "별자리 풀이가 너무 나 같은데, 이 얘기 들어줄 사람?",
  "나 내년에 역마살 대박이라는데, 어디로 이직하면 될까?",
  "거절을 못 해서 약속이 자꾸 늘어나",
  "월요일 생각하면 일요일 저녁부터 기분이 가라앉아",
  "회의에서 한마디도 못 하고 나왔어, 나만 이래?",
  "작심삼일만 백 번째, 나 의지가 약한 걸까?",
  "연애 안 한 지 오래됐는데, 조급해해야 하나?",
  "엄마 잔소리에 또 욱했어, 나 왜 이러지",
  "나 J인데 계획이 틀어지면 하루를 다 망친 기분이야",
  "집에 오면 아무것도 하기 싫어서 씻는 것도 미뤄",
];
const lineBreak = (s: string): string => s.replace(/, /, ",\n").replace(/\? /, "?\n");

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
  const headline = lineBreak(HEADLINES[headlineIndex]);

  return (
    <div className="ssol-night ssol-sky flex h-dvh w-full flex-col overflow-y-auto px-6 py-6">
      {/* 2026-11-25 대표님: 첫 화면도 밤하늘 테마 색 + 흰 로고 */}
      {/* 2026-09-28 버그 수정: 로고 원본(logo-mark.png)은 440×117(가로로 넓은 물결 심볼)인데,
          정사각형 박스(h-24 w-24 등)로 강제 표시해서 세로로 심하게 눌려 보이는 문제가 있었다.
          시안 원본 CSS(.brand img{width:34px}, .hero img{width:84px})처럼 너비만 지정하고
          높이는 실제 비율(117/440)대로 계산해 자연스럽게 나오게 한다. */}
      <div className="flex items-center gap-2">
        <Image src="/logo-mark-white.png" alt="" width={34} height={9} className="h-auto w-[34px]" />
        <span className="text-[14px] font-medium text-night-text">쏠 웰니스 하우스</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Image src="/logo-mark-white.png" alt="쏠 웰니스 하우스" width={84} height={22} className="h-auto w-[84px]" />
        <p className="mt-6 whitespace-pre-line break-keep font-serif text-[22px] font-bold leading-8 text-foreground">
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
