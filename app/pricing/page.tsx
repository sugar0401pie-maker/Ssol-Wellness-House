import AccessGate from "@/components/chat/AccessGate";
import AuthGate from "@/components/auth/AuthGate";
import PricingPage from "@/components/app/PricingPage";

export const metadata = { title: "이용권 안내 | 쏠 웰니스 하우스" };

export default function Pricing() {
  return (
    <AccessGate>
      <AuthGate>
        <PricingPage />
      </AuthGate>
    </AccessGate>
  );
}
