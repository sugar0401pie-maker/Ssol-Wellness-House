"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { isPlanId, type PlanId } from "@/lib/billing/pricing";

// 2026-10-01 owner 요청: 결제 완료 화면에 "며칠 연장됐는지"를 구체적으로 보여준다.
// 요금제가 정해져 있어 날짜 계산 없이 상수로 고정(월간=30일, 3개월=90일, 연간=365일) — 실제
// 만료일은 lib/billing/expiry.ts의 computeExpiryFor()가 달력 기준(월/연 단위)으로 계산하며,
// 이 문구는 그 결과를 그대로 보여주는 게 아니라 "대략 몇 일" 정도의 안내용 요약이다.
const PLAN_EXTEND_LABEL: Record<PlanId, string> = {
  monthly: "30일(1달 결제)",
  quarterly: "90일(3개월 결제)",
  annual: "365일(1년 결제)",
};

// 2026-09-27: 토스 결제창이 성공적으로 끝나면 이 주소로 돌아온다. 여기 넘어온 파라미터만
// 믿지 않고, 서버(app/api/billing/toss/confirm)에 다시 한번 실제 승인 여부를 확인시킨다.
export default function PricingSuccessPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<"checking" | "done" | "error">("checking");
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanId | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function confirm() {
      const paymentKey = params.get("paymentKey");
      const orderId = params.get("orderId");
      const amount = params.get("amount");
      if (!paymentKey || !orderId || !amount) {
        if (!cancelled) {
          setStatus("error");
          setError("결제 정보를 확인하지 못했어요.");
        }
        return;
      }
      const token = await getAccessToken();
      if (!token) {
        if (!cancelled) {
          setStatus("error");
          setError("로그인 정보를 확인하지 못했어요.");
        }
        return;
      }
      try {
        const res = await fetch("/api/billing/toss/confirm", {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
        });
        const data = await res.json();
        if (!cancelled) {
          if (res.ok) {
            if (isPlanId(data?.plan)) setPlan(data.plan);
            setStatus("done");
          } else {
            setStatus("error");
            setError(data?.error ?? "결제 확인에 실패했어요.");
          }
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setError("결제 확인 중 문제가 생겼어요.");
        }
      }
    }
    void confirm();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 py-10 text-center">
      {status === "checking" && <p className="text-[15px] text-slate-500">결제를 확인하는 중…</p>}
      {status === "done" && (
        <>
          <p className="text-[16px] font-medium text-foreground">결제가 완료됐어요</p>
          <p className="mt-2 text-[14px] leading-6 text-slate-500">이제 채팅을 계속 이용하실 수 있어요.</p>
          {plan && (
            <p className="mt-4 text-[14px] leading-6 text-foreground">
              감사합니다!
              <br />
              이용권이 {PLAN_EXTEND_LABEL[plan]} 연장되었습니다.
            </p>
          )}
        </>
      )}
      {status === "error" && (
        <>
          <p className="text-[16px] font-medium text-foreground">결제 확인에 실패했어요</p>
          <p className="mt-2 text-[14px] leading-6 text-slate-500">{error}</p>
        </>
      )}
      {status !== "checking" && (
        <button
          type="button"
          onClick={() => router.push("/home")}
          className="mt-8 h-11 w-full max-w-xs rounded-xl bg-navy text-sm font-medium text-white"
        >
          앱으로 돌아가기
        </button>
      )}
    </div>
  );
}
