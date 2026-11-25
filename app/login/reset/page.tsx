import AccessGate from "@/components/chat/AccessGate";
import AuthGate from "@/components/auth/AuthGate";
import RedirectToHome from "@/components/app/RedirectToHome";

export const metadata = { title: "비밀번호 재설정 | 쏠 웰니스 하우스" };

// 비밀번호 재설정 화면 주소(대표님 2026-11-25).
export default function ResetPage() {
  return (
    <AccessGate>
      <AuthGate initialMode="reset">
        <RedirectToHome />
      </AuthGate>
    </AccessGate>
  );
}
