import { Suspense } from "react";
import AccessGate from "@/components/chat/AccessGate";
import AuthGate from "@/components/auth/AuthGate";
import PricingSuccessPage from "@/components/app/PricingSuccessPage";

export const metadata = { title: "결제 완료 | 쏠 웰니스 하우스" };

// 2026-11-18: 카카오페이 결제창에서 결제가 끝나면 돌아오는 주소(/pricing/kakaopay/<주문번호>?pg_token=...).
// 화면은 토스 결제 완료와 같은 것을 쓰고, 승인 확인만 카카오페이 쪽 API로 한다.
export default async function KakaoPayReturn({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return (
    <AccessGate>
      <AuthGate>
        <Suspense fallback={null}>
          <PricingSuccessPage provider="kakaopay" orderId={orderId} />
        </Suspense>
      </AuthGate>
    </AccessGate>
  );
}
