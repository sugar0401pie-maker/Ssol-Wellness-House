import AccessGate from "@/components/chat/AccessGate";
import AuthGate from "@/components/auth/AuthGate";
import PackagesPage from "@/components/app/PackagesPage";

export const metadata = { title: "오프라인 웰니스 패키지 | 쏠 웰니스 하우스" };

export default function Packages() {
  return (
    <AccessGate>
      <AuthGate>
        <PackagesPage />
      </AuthGate>
    </AccessGate>
  );
}
