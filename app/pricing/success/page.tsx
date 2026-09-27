import { Suspense } from "react";
import AccessGate from "@/components/chat/AccessGate";
import AuthGate from "@/components/auth/AuthGate";
import PricingSuccessPage from "@/components/app/PricingSuccessPage";

export const metadata = { title: "결제 완료 | 쏠 웰니스 하우스" };

export default function PricingSuccess() {
  return (
    <AccessGate>
      <AuthGate>
        <Suspense fallback={null}>
          <PricingSuccessPage />
        </Suspense>
      </AuthGate>
    </AccessGate>
  );
}
