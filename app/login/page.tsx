import AccessGate from "@/components/chat/AccessGate";
import AuthGate from "@/components/auth/AuthGate";
import RedirectToHome from "@/components/app/RedirectToHome";

export const metadata = { title: "로그인 | 쏠 웰니스 하우스" };

// 로그인 화면 주소(대표님 2026-11-25). 로그인되면 ?next=의 화면(없으면 홈)으로.
export default function LoginPage() {
  return (
    <AccessGate>
      <AuthGate initialMode="signin">
        <RedirectToHome />
      </AuthGate>
    </AccessGate>
  );
}
