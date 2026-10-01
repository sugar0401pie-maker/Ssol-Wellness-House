"use client";

import Link from "next/link";

// 2026-10-01 owner 요청: 무료체험(심층보고서 보유 여부로 7일 또는 3일) 종료가 임박한 계정에게 구독을 유도하는
// 팝업 — 종료 이틀 전(D-2)과 하루 전(D-1)에 서로 다른 문구로 보여준다. OAuthProfileReminder와
// 같은 패턴으로 "닫기"(이번 세션만 안 보임)와 "오늘 하루 보지 않기"(오늘은 다시 안 뜸) 둘 다
// 지원한다. 문구는 owner가 준 텍스트 그대로.
//
// 2026-10-01 추가: 심층보고서가 없는 사용자(3일 체험)의 D-1(=3일째, 마지막 날)에는 "보고서를
// 보면 7일 더 무료"라는 더 구체적인 유도 문구로 바꾼다 — 보고서가 생기면 체험이 7일로
// 늘어나는 실제 동작(lib/billing/access.ts)과 정확히 맞는 안내라서, 이 경우에만 일반 D-1
// 문구 대신 쓴다. 보고서가 이미 있는 사용자(7일 체험)의 D-1(=7일째)에는 해당 없음 — 그
// 사람에게는 "보고서 보면 더 받는다"는 말이 의미가 없으므로 기존 문구 그대로.
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

const D1_NO_REPORT_COPY = {
  lead: "심리테스트 심층보고서를 보시면 7일 더 무료로 쓸 수 있어요!",
  body: "아니면 1달권을 지금 바로 구독하셔도 돼요. 😉",
};

export default function TrialExpiringReminder({
  variant,
  hasReport,
  onDismissToday,
  onClose,
}: {
  variant: TrialExpiringVariant;
  hasReport: boolean;
  onDismissToday: () => void;
  onClose: () => void;
}) {
  const copy = variant === "d1" && !hasReport ? D1_NO_REPORT_COPY : COPY[variant];
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
