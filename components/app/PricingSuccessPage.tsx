"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { isPlanId, type PlanId } from "@/lib/billing/pricing";
import { reportPurchase } from "@/lib/ads/googleAds";

// 2026-10-01 owner 요청: 결제 완료 화면에 "며칠 연장됐는지"를 구체적으로 보여준다.
// 요금제가 정해져 있어 날짜 계산 없이 상수로 고정(월간=30일, 3개월=90일, 연간=365일) — 실제
// 만료일은 lib/billing/expiry.ts의 computeExpiryFor()가 달력 기준(월/연 단위)으로 계산하며,
// 이 문구는 그 결과를 그대로 보여주는 게 아니라 "대략 몇 일" 정도의 안내용 요약이다.
const PLAN_EXTEND_LABEL: Record<PlanId, string> = {
  monthly: "30일(1달 결제)",
  quarterly: "90일(3개월 결제)",
  annual: "365일(1년 결제)",
};

// 결제가 끝나면 돌아오는 화면. 2026-11-18부터 카카오페이만 쓴다(토스 제거): 돌아온 주소의 pg_token과 경로의 주문 번호로
// 서버(app/api/billing/kakaopay/approve)에 실제 승인과 금액 확인을 시키고, 그 결과만 보여 준다(브라우저 값만 믿지 않는다).
export default function PricingSuccessPage({ orderId }: { orderId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<"checking" | "done" | "error">("checking");
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanId | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function confirm() {
      const pgToken = params.get("pg_token");
      const token = await getAccessToken();
      if (!pgToken || !orderId || !token) {
        if (!cancelled) {
          setStatus("error");
          setError(!token ? "로그인 정보를 확인하지 못했어요." : "결제 정보를 확인하지 못했어요.");
        }
        return;
      }
      try {
        const res = await fetch("/api/billing/kakaopay/approve", { method: "POST", headers: authHeaders(token), body: JSON.stringify({ orderId, pgToken }) });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          if (isPlanId(data?.plan)) setPlan(data.plan);
          setStatus("done");
          // 2026-11-24: 구글 광고 결제 전환 — 이번에 새로 승인된 결제만(이미 처리된 주문을 다시 연 경우 제외), 실제 금액·주문 번호로 한 번.
          if (!data?.already && typeof data?.amount === "number") reportPurchase({ value: data.amount, transactionId: String(data.orderId ?? orderId) });
        } else {
          setStatus("error");
          setError(data?.error ?? "결제 확인에 실패했어요.");
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
