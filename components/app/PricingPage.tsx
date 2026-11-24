"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import {
  MONTHLY_PRICE,
  ANNUAL_PRICE,
  ANNUAL_MONTHLY_EQUIVALENT,
  ANNUAL_SAVINGS_PERCENT,
  PROMO_MONTHLY_PRICE,
  PROMO_QUARTERLY_PRICE,
  PROMO_QUARTERLY_MONTHLY_EQUIVALENT,
  PROMO_ANNUAL_PRICE,
  PROMO_ANNUAL_MONTHLY_EQUIVALENT,
  PROMO_LABEL,
  isPromoActive,
  type PlanId,
} from "@/lib/billing/pricing";
import KakaoPayButton from "@/components/billing/KakaoPayButton";
import OfflineSessionCode from "@/components/billing/OfflineSessionCode";
import { isMobileUserAgent } from "@/lib/billing/kakaopayRequest";

// 2026-09-27: "이용권 결제하기" 눌러 들어오는 요금 안내 + 결제 화면(전용 주소 /pricing).
//
// 2026-11-18 대표님 결정: 토스페이먼츠를 쓰지 않고 카카오페이(직접 연동)만 쓴다. 주문서 없이 이용권 버튼을 누르면
// app/api/billing/kakaopay/ready가 주문(pending)을 만들고 카카오페이 결제창 주소를 돌려주며, 브라우저가 바로 그 창으로 간다.
// 결제가 끝나면 /pricing/kakaopay/<주문번호>로 돌아와 app/api/billing/kakaopay/approve가 서버 승인·금액 확인을 마친 뒤에만 이용권이 열린다.
// 약관 동의는 사이트 안 체크 칸 없이 버튼 아래 안내 문구로 갈음한다(카카오페이 결제창이 따로 동의를 받는다 — 대표님 결정).
// 서버에 카카오페이 키나 DB 칸이 없으면(/api/billing/methods가 false) 버튼을 막고 "결제 준비 중" 안내를 보인다.
//
// 2026-10-01 owner 요청: "10월 한정 · 오픈 기념 이용권 할인" 프로모션 문구/가격으로 교체.
// 실제 결제 금액은 서버가 lib/billing/pricing.ts의 currentPrice()로 똑같이 계산하므로, 여기서 보여주는 할인가와
// 실제 청구 금액이 어긋날 일이 없다 — 이 페이지는 isPromoActive()로 "표시만" 분기한다.

function won(n: number): string {
  return `${n.toLocaleString()}원`;
}

const MONTHLY_FEATURES = [
  "SSOL AI 웰니스 채팅 이용",
  "개인화된 일일 작은 제안",
  "온보딩 정보 기반 맞춤 대화",
  "부담 없이 한 달 단위로 이용",
];

// 2026-10-05: 10월 한정 3개월권. 2026-10-06 가격 재변경(월 2,900원 x 3개월 = 8,700원 일시 결제).
const QUARTERLY_FEATURES = [
  "SSOL AI 웰니스 채팅 3개월 이용",
  "개인화된 일일 작은 제안",
  "온보딩 정보 기반 맞춤 대화",
  "3개월 특가 적용",
];

const ANNUAL_FEATURES = [
  "SSOL AI 웰니스 채팅 12개월 이용",
  "개인화된 일일 작은 제안",
  "온보딩 정보 기반 맞춤 대화",
  "연간 오픈 특가 적용",
];

const PAY_LABEL = "카카오페이로 결제하고 바로 시작하기";

export default function PricingPage() {
  const router = useRouter();
  const promoActive = isPromoActive();
  const [submitting, setSubmitting] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 카카오페이 결제를 쓸 수 있는지(서버에 키·DB 칸이 있는지). null = 아직 확인 중.
  const [ready, setReady] = useState<boolean | null>(null);
  const searchParams = useSearchParams();
  const kakaoCanceled = searchParams.get("kakaopay") === "cancel";

  useEffect(() => {
    let alive = true;
    fetch("/api/billing/methods", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (alive) setReady(d?.kakaopay === true); })
      .catch(() => { if (alive) setReady(false); });
    return () => { alive = false; };
  }, []);

  async function pay(plan: PlanId) {
    if (submitting || !ready) return;
    setSubmitting(plan);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError("로그인 정보를 확인하지 못했어요. 새로고침 후 다시 시도해주세요.");
        setSubmitting(null);
        return;
      }
      const res = await fetch("/api/billing/kakaopay/ready", { method: "POST", headers: authHeaders(token), body: JSON.stringify({ plan }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.pcUrl) throw new Error(data?.error);
      // 카카오페이가 준 결제 화면으로 바로 이동한다(휴대폰은 모바일 화면 → 카카오톡, 컴퓨터는 PC 화면).
      window.location.href = isMobileUserAgent(navigator.userAgent) ? data.mobileUrl : data.pcUrl;
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "카카오페이 결제창을 열지 못했어요. 잠시 후 다시 시도해주세요.");
      setSubmitting(null);
    }
  }

  const disabled = submitting !== null || ready !== true;

  const monthlyCard = (
    <PlanCard
      title={promoActive ? "1개월권" : "월간 멤버십"}
      originalPrice={promoActive ? won(MONTHLY_PRICE) : undefined}
      price={promoActive ? won(PROMO_MONTHLY_PRICE) : won(MONTHLY_PRICE)}
      priceUnit={promoActive ? "/ 1개월" : "/ 월"}
      badgeLabel={promoActive ? PROMO_LABEL : undefined}
      sub={promoActive ? undefined : "매달 결제"}
      features={promoActive ? MONTHLY_FEATURES : undefined}
      highlight={false}
      onApply={() => pay("monthly")}
      submitting={submitting === "monthly"}
      disabled={disabled}
    />
  );

  const annualCard = (
    <PlanCard
      title="연간 멤버십"
      highlightLabel="가장 큰 혜택"
      originalPrice={promoActive ? won(ANNUAL_PRICE) : undefined}
      price={promoActive ? won(PROMO_ANNUAL_PRICE) : won(ANNUAL_PRICE)}
      priceUnit="/ 1년"
      sub={
        promoActive
          ? `월 ${PROMO_ANNUAL_MONTHLY_EQUIVALENT.toLocaleString()}원 × 12개월`
          : `월 환산 ${won(ANNUAL_MONTHLY_EQUIVALENT)} · 월간 대비 약 ${ANNUAL_SAVINGS_PERCENT}% 절약`
      }
      features={promoActive ? ANNUAL_FEATURES : undefined}
      highlight
      onApply={() => pay("annual")}
      submitting={submitting === "annual"}
      disabled={disabled}
    />
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-white px-5 py-8">
      <button type="button" onClick={() => router.push("/home")} className="mb-4 self-start text-[13px] text-slate-500">
        ← 뒤로
      </button>

      {promoActive ? (
        <>
          <h1 className="text-[19px] font-medium text-foreground">오픈 기념 이용권 할인</h1>
          <p className="mt-1.5 text-[15px] font-medium text-foreground">매일, 마음을 정리하는 가장 가벼운 루틴</p>
          <p className="mt-2 text-[14px] leading-6 text-slate-500">
            쏘웰라와 부담 없이 대화하며 생각을 정리하고, 지금의 나에게 맞는 작은 변화를 만들어보세요.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-[19px] font-medium text-foreground">이용권 안내</h1>
          <p className="mt-1.5 text-[14px] leading-6 text-slate-500">
            가입 후 심층보고서가 있으면 7일, 없으면 3일 무료로 이용하실 수 있어요. 이후에는 이용권 결제가 필요해요.
          </p>
        </>
      )}

      {ready === false && (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-[13px] leading-5 text-slate-600">결제 준비 중이에요. 잠시 후 다시 시도해주세요.</p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {/* 2026-10-05 owner 요청: 10월 한정 3개월권을 맨 위에 — "월 2,900원"으로 보이되 실제 청구는 3개월
            합계(8,700원)라서, 바로 아래 줄에 실제 결제 금액을 같이 적는다. 프로모션 기간 밖에는 이 카드가
            아예 없고(서버도 같은 기준으로 막는다), 아래 월간·연간 카드만 남는다. */}
        {promoActive && (
          <PlanCard
            title="3개월 멤버십"
            originalPrice={`${won(MONTHLY_PRICE)} (월 기준)`}
            price={won(PROMO_QUARTERLY_MONTHLY_EQUIVALENT)}
            priceUnit="/ 월 · 3개월 결제 시"
            badgeLabel={PROMO_LABEL}
            sub={`3개월 ${won(PROMO_QUARTERLY_PRICE)} 결제 (월 ${PROMO_QUARTERLY_MONTHLY_EQUIVALENT.toLocaleString()}원 × 3개월)`}
            features={QUARTERLY_FEATURES}
            highlight={false}
            onApply={() => pay("quarterly")}
            submitting={submitting === "quarterly"}
            disabled={disabled}
          />
        )}
        {/* 2026-10-05 owner 요청: 프로모션 중에는 3개월권 → 연간 → 1개월권 순서. 프로모션이 아닐 때는
            기존 순서(월간 → 연간)를 그대로 둔다. */}
        {promoActive ? (
          <>
            {annualCard}
            {monthlyCard}
          </>
        ) : (
          <>
            {monthlyCard}
            {annualCard}
          </>
        )}
      </div>

      {kakaoCanceled && !error && <p className="mt-3 text-[13px] text-slate-500">카카오페이 결제를 취소했어요. 결제된 금액은 없어요.</p>}
      {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}

      <OfflineSessionCode />

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
  originalPrice,
  price,
  priceUnit,
  badgeLabel,
  sub,
  features,
  highlight,
  highlightLabel = "추천",
  onApply,
  submitting,
  disabled,
}: {
  title: string;
  originalPrice?: string;
  price: string;
  priceUnit: string;
  badgeLabel?: string;
  sub?: string;
  features?: string[];
  highlight: boolean;
  highlightLabel?: string;
  onApply: () => void;
  submitting: boolean;
  disabled: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-navy bg-navy-soft" : "border-line bg-white"}`}>
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] font-medium text-foreground">{title}</p>
        {highlight && (
          <span className="rounded-full bg-navy px-2 py-0.5 text-[11px] font-medium text-white">{highlightLabel}</span>
        )}
      </div>
      {originalPrice && <p className="mt-1.5 text-[13px] text-slate-400 line-through">정가 {originalPrice}</p>}
      <p className="mt-0.5 text-[22px] font-semibold text-foreground">
        {price} <span className="text-[14px] font-normal text-slate-500">{priceUnit}</span>
      </p>
      {badgeLabel && <p className="mt-0.5 text-[12.5px] font-medium text-navy">{badgeLabel}</p>}
      {sub && <p className="mt-0.5 text-[13px] text-slate-500">{sub}</p>}
      {features && features.length > 0 && (
        <ul className="mt-3 space-y-1 text-[13px] leading-5 text-slate-600">
          {features.map((f) => (
            <li key={f} className="flex gap-1.5">
              <span className="text-navy">·</span>
              {f}
            </li>
          ))}
        </ul>
      )}
      <KakaoPayButton label={PAY_LABEL} onClick={onApply} busy={submitting} disabled={disabled} />
    </div>
  );
}
