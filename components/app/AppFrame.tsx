"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import OnboardingFlow from "./OnboardingFlow";
import OAuthProfileGate from "./OAuthProfileGate";
import OAuthProfileReminder from "./OAuthProfileReminder";
import TrialExpiringReminder, { type TrialExpiringVariant } from "./TrialExpiringReminder";
import { signOut } from "@/lib/supabase/authClient";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { todayKeyKST } from "@/lib/safety/dailyLimit";

// 2026-10-01: "오늘 하루 보지 않기"를 기억하는 로컬 키. 값은 그날의 todayKeyKST() 문자열 —
// 오늘 날짜와 같으면 오늘은 리마인더를 또 띄우지 않는다(다음 날이면 자동으로 다시 뜸).
const OAUTH_REMINDER_DISMISS_KEY = "oauthProfileReminderDismissedDate";

// 2026-10-01 owner 요청: 무료체험 종료 이틀 전(D-2)·하루 전(D-1) 구독 유도 팝업 — 계정별
// trialDaysLeft(이미 app/api/billing/status가 계산해서 주는 값, lib/billing/access.ts의
// computeAccess 하나만 보는 단일 기준)를 그대로 써서 "오늘이 며칠째인지" 따로 계산하지 않는다.
const TRIAL_REMINDER_DISMISS_KEY = "trialExpiringReminderDismissedDate";

// 2026-09-28: owner 요청으로 홈/채팅/마이페이지를 "/home", "/chat", "/mypage" 개별 주소로
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
  { href: "/home", label: "홈" },
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
  // 2026-09-28 owner 요청으로 변경: 이제 "닫기"로 일단 건너뛸 수 있다 — dismissed는 이
  // 컴포넌트가 마운트돼 있는 동안(=이번 로그인 세션 동안)만 기억하는 화면 상태일 뿐, 서버에
  // 저장되지 않는다. 그래서 로그아웃 후 다시 로그인하면(AppFrame이 새로 마운트되면)
  // dismissed도 false로 초기화돼 온보딩이 자동으로 다시 뜬다 — 완료 전까지 계속.
  const [onboarding, setOnboarding] = useState<OnboardingInfo | "loading" | "error">("loading");
  const [dismissed, setDismissed] = useState(false);
  // 2026-09-28 신설: 카카오/네이버 가입자는 이름·생년월일이 비어 있을 수 있다 — 온보딩보다
  // 먼저 확인해서, 필요하면 OAuthProfileGate(회원가입과 비슷한 추가 정보 입력)를 온보딩보다
  // 먼저 띄운다. 이메일 가입자는 needsCompletion이 항상 false라 안 보인다.
  // 2026-10-01 owner 요청으로 변경: 더 이상 서비스 이용 자체를 막지 않는다(필수 아님) — 대신
  // 작은 리마인더(OAuthProfileReminder)를 먼저 보여주고, "확인"을 눌러야 이 입력 폼이 뜬다.
  // "오늘 하루 보지 않기"를 누르면 오늘은 리마인더 자체가 안 뜬다.
  const [oauthProfile, setOauthProfile] = useState<
    { needsCompletion: boolean; suggestedName: string | null } | "loading" | "error"
  >("loading");
  const [showOauthForm, setShowOauthForm] = useState(false);
  const [oauthReminderSessionDismissed, setOauthReminderSessionDismissed] = useState(false);
  const [oauthReminderDismissedToday, setOauthReminderDismissedToday] = useState(() => {
    try {
      return localStorage.getItem(OAUTH_REMINDER_DISMISS_KEY) === todayKeyKST();
    } catch {
      return false;
    }
  });

  function dismissOauthReminderToday() {
    try {
      localStorage.setItem(OAUTH_REMINDER_DISMISS_KEY, todayKeyKST());
    } catch {
      // localStorage를 못 쓰는 환경(사생활 보호 모드 등)이면 이번 세션만 안 보이게 한다.
    }
    setOauthReminderDismissedToday(true);
  }

  // 2026-10-01: 무료체험 종료 D-2/D-1 구독 유도 팝업. billing은 /api/billing/status를 그대로
  // 받아두고(마이페이지의 "이용권 정보"와 같은 값), reason이 "trial"일 때만(이미 구독 중이거나
  // 체험이 끝난 계정에는 안 보임) trialDaysLeft로 변형(variant)을 정한다. trialDays(7 또는 3)로
  // hasReport를 역산한다 — 서버가 이미 심층보고서 보유 여부로 trialDays를 정해서 내려주므로
  // 따로 다시 조회하지 않는다.
  const [billing, setBilling] = useState<
    { reason: "entitlement" | "trial" | "expired"; trialDaysLeft: number; trialDays: number } | null
  >(null);
  const [trialReminderSessionDismissed, setTrialReminderSessionDismissed] = useState(false);
  const [trialReminderDismissedToday, setTrialReminderDismissedToday] = useState(() => {
    try {
      return localStorage.getItem(TRIAL_REMINDER_DISMISS_KEY) === todayKeyKST();
    } catch {
      return false;
    }
  });
  function dismissTrialReminderToday() {
    try {
      localStorage.setItem(TRIAL_REMINDER_DISMISS_KEY, todayKeyKST());
    } catch {
      // localStorage를 못 쓰는 환경이면 이번 세션만 안 보이게 한다.
    }
    setTrialReminderDismissedToday(true);
  }
  const trialReminderVariant: TrialExpiringVariant | null =
    billing?.reason === "trial" ? (billing.trialDaysLeft === 2 ? "d2" : billing.trialDaysLeft === 1 ? "d1" : null) : null;
  const trialReminderHasReport = billing?.trialDays === 7;

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const token = await getAccessToken();
      if (!token) {
        if (!cancelled) {
          setOnboarding("error");
          setOauthProfile("error");
        }
        return;
      }
      try {
        const [onboardingRes, profileRes] = await Promise.all([
          fetch("/api/onboarding", { headers: authHeaders(token) }),
          fetch("/api/profile", { headers: authHeaders(token) }),
        ]);
        if (!onboardingRes.ok) throw new Error();
        const onboardingJson = (await onboardingRes.json()) as OnboardingInfo;
        if (!cancelled) setOnboarding(onboardingJson);

        if (!profileRes.ok) throw new Error();
        const profileJson = (await profileRes.json()) as { needsCompletion: boolean; suggestedName: string | null };
        if (!cancelled) setOauthProfile(profileJson);
      } catch {
        // 확인 자체가 실패하면 안전하게 막지 않고 그냥 넘어간다(각각 독립적으로 실패 처리).
        if (!cancelled) {
          setOnboarding((prev) => (prev === "loading" ? "error" : prev));
          setOauthProfile((prev) => (prev === "loading" ? "error" : prev));
        }
      }
      // 무료체험 D-2/D-1 리마인더용 — 부가 기능이라 실패해도(네트워크 등) 조용히 건너뛴다
      // (billing이 null로 남아 리마인더가 안 뜰 뿐, 다른 화면 동작엔 영향 없다).
      try {
        const billingRes = await fetch("/api/billing/status", { headers: authHeaders(token) });
        if (billingRes.ok) {
          const billingJson = (await billingRes.json()) as {
            reason: "entitlement" | "trial" | "expired";
            trialDaysLeft: number;
            trialDays: number;
          };
          if (!cancelled) setBilling(billingJson);
        }
      } catch {
        // 무시 — 위 주석 참고.
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const needsOnboarding = typeof onboarding === "object" && !onboarding.completed;
  const needsOauthProfile = typeof oauthProfile === "object" && oauthProfile.needsCompletion;
  const showOauthReminder =
    needsOauthProfile && !showOauthForm && !oauthReminderSessionDismissed && !oauthReminderDismissedToday;
  const showOauthGateForm = needsOauthProfile && showOauthForm;
  const oauthFlowActive = showOauthReminder || showOauthGateForm;
  const showTrialReminder =
    trialReminderVariant !== null &&
    !oauthFlowActive &&
    !(needsOnboarding && !dismissed) &&
    !trialReminderSessionDismissed &&
    !trialReminderDismissedToday;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-white shadow-sm sm:border-x sm:border-line">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        {/* 2026-09-28: 디자인 시안 적용 — 흰 박스 로고(logo.jpg) 대신 투명 배경 물결 심볼 사용.
            로고 원본은 440×117(가로로 넓음) — 정사각형으로 강제하면 눌려 보여서(버그 수정),
            시안의 상단 브랜드 로고와 같은 34px 너비 기준으로 높이는 실제 비율대로 계산한다. */}
        <div className="flex items-center gap-1.5">
          <Image src="/logo-mark.png" alt="" width={34} height={9} className="h-auto w-[34px]" />
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
      {/* 2026-10-01: needsOauthProfile이어도 더 이상 내용 자체를 막지 않는다 — 아래 리마인더/
          입력 폼은 다른 팝업처럼 이 내용 위에 겹쳐서(오버레이) 뜬다. */}
      {onboarding !== "loading" && oauthProfile !== "loading" && (!needsOnboarding || dismissed) && (
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      )}

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

      {showOauthReminder && (
        <OAuthProfileReminder
          onConfirm={() => setShowOauthForm(true)}
          onDismissToday={dismissOauthReminderToday}
          onClose={() => setOauthReminderSessionDismissed(true)}
        />
      )}

      {showOauthGateForm && typeof oauthProfile === "object" && (
        <OAuthProfileGate
          suggestedName={oauthProfile.suggestedName}
          onDone={() => setOauthProfile({ ...oauthProfile, needsCompletion: false })}
          onClose={() => setShowOauthForm(false)}
        />
      )}

      {!oauthFlowActive && needsOnboarding && !dismissed && typeof onboarding === "object" && (
        <OnboardingFlow
          mode="gate"
          nickname={onboarding.nickname}
          title={onboarding.title}
          onDone={() => setOnboarding({ ...onboarding, completed: true })}
          onClose={() => setDismissed(true)}
        />
      )}

      {showTrialReminder && trialReminderVariant && (
        <TrialExpiringReminder
          variant={trialReminderVariant}
          hasReport={trialReminderHasReport}
          onDismissToday={dismissTrialReminderToday}
          onClose={() => setTrialReminderSessionDismissed(true)}
        />
      )}
    </div>
  );
}
