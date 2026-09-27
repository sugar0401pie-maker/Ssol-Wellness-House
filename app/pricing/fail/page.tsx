import { Suspense } from "react";
import AccessGate from "@/components/chat/AccessGate";
import AuthGate from "@/components/auth/AuthGate";
import PricingFailPage from "@/components/app/PricingFailPage";

export const metadata = { title: "결제 실패 | 쏠 웰니스 하우스" };

export default function PricingFail() {
  return (
    <AccessGate>
      <AuthGate>
        <Suspense fallback={null}>
          <PricingFailPage />
        </Suspense>
      </AuthGate>
    </AccessGate>
  );
}
