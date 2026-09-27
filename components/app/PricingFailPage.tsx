"use client";

import { useRouter, useSearchParams } from "next/navigation";

// 2026-09-27: 결제창에서 취소하거나 실패하면 토스가 이 주소로 돌려보낸다. 이 신청 건은
// app/api/billing/toss/confirm이 호출되지 않아 chat_entitlements에 pending 상태로 남는데,
// 그대로 둬도 무료체험/이용권 판정에 영향을 주지 않는다(활성 상태가 아니므로).
export default function PricingFailPage() {
  const router = useRouter();
  const params = useSearchParams();
  const message = params.get("message") ?? "결제가 취소됐거나 실패했어요.";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 py-10 text-center">
      <p className="text-[16px] font-medium text-foreground">결제를 완료하지 못했어요</p>
      <p className="mt-2 text-[14px] leading-6 text-slate-500">{message}</p>
      <button
        type="button"
        onClick={() => router.push("/pricing")}
        className="mt-8 h-11 w-full max-w-xs rounded-xl bg-navy text-sm font-medium text-white"
      >
        다시 시도하기
      </button>
    </div>
  );
}
