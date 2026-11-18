import { Suspense } from "react";
import AccessGate from "@/components/chat/AccessGate";
import AuthGate from "@/components/auth/AuthGate";
import PricingPage from "@/components/app/PricingPage";

export const metadata = { title: "이용권 안내 | 쏠 웰니스 하우스" };

export default function Pricing() {
  return (
    <AccessGate>
      <AuthGate>
        {/* 2026-11-18: 카카오페이 취소 후 돌아온 표시(?kakaopay=cancel)를 읽느라 useSearchParams를 쓰므로 Suspense가 필요하다 */}
        <Suspense fallback={null}>
          <PricingPage />
        </Suspense>
      </AuthGate>
    </AccessGate>
  );
}
