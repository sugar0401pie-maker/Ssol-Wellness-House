"use client";

import { useRouter } from "next/navigation";

// 2026-09-27: 무료체험(가입 후 7일)이 끝난 사용자에게 채팅 입력 대신 보여준다. 다른 탭(홈,
// 마이페이지)은 계속 쓸 수 있어야 하므로, 앱 전체를 막지 않고 채팅 화면 안에서만 보여준다.
// 2026-10-01: 무료체험 일수가 심층보고서 보유 여부로 7일/3일 갈려서, 실제 적용된 일수를
// 부모(ChatApp)로부터 받아 보여준다.
export default function TrialPaywallOverlay({ trialDays }: { trialDays: number }) {
  const router = useRouter();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <p className="text-[16px] font-medium text-foreground">무료체험 기간이 끝났어요</p>
      <p className="text-[14px] leading-6 text-slate-500">
        가입 후 {trialDays}일간 무료로 이용하실 수 있었어요.
        <br />
        계속 대화를 나누려면 이용권이 필요해요.
      </p>
      <button
        type="button"
        onClick={() => router.push("/pricing")}
        className="h-11 w-full max-w-xs rounded-xl bg-navy text-sm font-medium text-white"
      >
        이용권 결제하기
      </button>
      <button
        type="button"
        onClick={() => router.push("/packages")}
        className="text-[13px] text-slate-500 underline underline-offset-2"
      >
        오프라인 웰니스 패키지 알아보기
      </button>
    </div>
  );
}
