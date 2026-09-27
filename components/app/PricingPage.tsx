"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import {
  MONTHLY_PRICE,
  ANNUAL_PRICE,
  ANNUAL_MONTHLY_EQUIVALENT,
  ANNUAL_SAVINGS_PERCENT,
  type PlanId,
} from "@/lib/billing/pricing";

// 2026-09-27: "이용권 결제하기" 눌러 들어오는 요금 안내 + 신청 화면. 전용 주소(/pricing)를
// 할당해달라는 요청대로 별도 페이지로 만든다. 토스페이먼츠 연동 전이라 신청만 접수하고,
// 실제 결제 연동 후 이 화면의 버튼이 토스 결제창을 여는 방식으로 바뀔 예정이다.
function won(n: number): string {
  return `${n.toLocaleString()}원`;
}

export default function PricingPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<PlanId | null>(null);
  const [done, setDone] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function apply(plan: PlanId) {
    if (submitting) return;
    setSubmitting(plan);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError("로그인 정보를 확인하지 못했어요. 새로고침 후 다시 시도해주세요.");
        return;
      }
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error();
      setDone(plan);
    } catch {
      setError("신청 접수에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-white px-5 py-8">
      <button type="button" onClick={() => router.push("/")} className="mb-4 self-start text-[13px] text-slate-500">
        ← 뒤로
      </button>

      <h1 className="text-[19px] font-medium text-foreground">이용권 안내</h1>
      <p className="mt-1.5 text-[14px] leading-6 text-slate-500">
        가입 후 7일은 무료로 이용하실 수 있어요. 이후에는 이용권 결제가 필요해요.
      </p>

      {done ? (
        <div className="mt-8 rounded-2xl bg-navy-soft p-5 text-center">
          <p className="text-[15px] font-medium text-foreground">신청이 접수됐어요</p>
          <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
            확인 후 결제 안내를 드릴게요. 결제가 완료되면 바로 이용하실 수 있어요.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          <PlanCard
            title="월간 이용권"
            price={won(MONTHLY_PRICE)}
            sub="매달 결제"
            highlight={false}
            onApply={() => apply("monthly")}
            submitting={submitting === "monthly"}
            disabled={submitting !== null}
          />
          <PlanCard
            title="연간 이용권"
            price={won(ANNUAL_PRICE)}
            sub={`월 환산 ${won(ANNUAL_MONTHLY_EQUIVALENT)} · 월간 대비 약 ${ANNUAL_SAVINGS_PERCENT}% 절약`}
            highlight
            onApply={() => apply("annual")}
            submitting={submitting === "annual"}
            disabled={submitting !== null}
          />
        </div>
      )}

      {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}

      <div className="mt-6 rounded-xl border border-line bg-background p-4 text-[13px] leading-5 text-slate-500">
        <p className="font-medium text-foreground">오프라인 웰니스 세션을 이용 중이신가요?</p>
        <p className="mt-1">오프라인 웰니스 세션 패키지를 이용하고 계신 분은 패키지별로 채팅을 무료로 이용하실 수 있어요.</p>
      </div>

      <div className="mt-6 text-[12px] leading-5 text-slate-400">
        <p className="font-medium text-slate-500">이용 관련 안내</p>
        <p className="mt-1">이용권은 결제 확인 후 바로 적용돼요. 이용 시작 후 7일 이내 미사용 시 전액 환불해드려요.</p>
        <p className="mt-1">
          자세한 환불·해지 규정은{" "}
          <a href="/legal#terms" target="_blank" rel="noreferrer" className="text-navy underline">
            이용약관
          </a>
          을 확인해주세요.
        </p>
      </div>

      <button
        type="button"
        onClick={() => router.push("/packages")}
        className="mt-8 text-center text-[13px] text-slate-500 underline underline-offset-2"
      >
        오프라인 웰니스 패키지 알아보기
      </button>
    </div>
  );
}

function PlanCard({
  title,
  price,
  sub,
  highlight,
  onApply,
  submitting,
  disabled,
}: {
  title: string;
  price: string;
  sub: string;
  highlight: boolean;
  onApply: () => void;
  submitting: boolean;
  disabled: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-navy bg-navy-soft" : "border-line bg-white"}`}>
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] font-medium text-foreground">{title}</p>
        {highlight && <span className="rounded-full bg-navy px-2 py-0.5 text-[11px] font-medium text-white">추천</span>}
      </div>
      <p className="mt-1.5 text-[22px] font-semibold text-foreground">{price}</p>
      <p className="mt-0.5 text-[13px] text-slate-500">{sub}</p>
      <button
        type="button"
        onClick={onApply}
        disabled={disabled}
        className="mt-3 h-11 w-full rounded-xl bg-navy text-sm font-medium text-white disabled:opacity-40"
      >
        {submitting ? "신청하는 중…" : "이용권 결제하기"}
      </button>
    </div>
  );
}
