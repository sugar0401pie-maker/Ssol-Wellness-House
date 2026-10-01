"use client";

import Link from "next/link";

// 2026-10-01 owner 요청: 무료체험(심층보고서 보유 여부로 7일 또는 3일) 종료가 임박한 계정에게 구독을 유도하는
// 팝업 — 종료 이틀 전(D-2)과 하루 전(D-1)에 서로 다른 문구로 보여준다. OAuthProfileReminder와
// 같은 패턴으로 "닫기"(이번 세션만 안 보임)와 "오늘 하루 보지 않기"(오늘은 다시 안 뜸) 둘 다
// 지원한다. 문구는 owner가 준 텍스트 그대로.
export type TrialExpiringVariant = "d2" | "d1";

const COPY: Record<TrialExpiringVariant, { lead: string; body: string }> = {
  d2: {
    lead: "무료 체험 기간이 딱 이틀 남았어요!",
    body: "10월 한 달간 오픈 기념으로 저렴하게 구독할 수 있어요.",
  },
  d1: {
    lead: "쏘웰라를 확실히 곁에 두는 방법을 알려드려요.",
    body: "오늘 구독하세요! 오늘 연장하지 않으면 내일부터 쏘웰라 무료 체험이 종료됩니다.",
  },
};

export default function TrialExpiringReminder({
  variant,
  onDismissToday,
  onClose,
}: {
  variant: TrialExpiringVariant;
  onDismissToday: () => void;
  onClose: () => void;
}) {
  const copy = COPY[variant];
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-lg">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-mr-1.5 -mt-1.5 rounded-full px-2 py-1 text-[12px] text-slate-400"
          >
            닫기
          </button>
        </div>
        <p className="text-center text-[15px] leading-7 text-foreground">
          {copy.lead}
          <br />
          <br />
          {copy.body}
        </p>
        <Link
          href="/pricing"
          className="mt-5 block h-11 w-full rounded-xl bg-navy text-center text-[14px] font-medium leading-[44px] text-white"
        >
          구독하기
        </Link>
        <button type="button" onClick={onDismissToday} className="mt-2 h-9 w-full text-[13px] text-slate-500">
          오늘 하루 보지 않기
        </button>
      </div>
    </div>
  );
}
