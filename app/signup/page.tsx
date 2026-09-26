import AccessGate from "@/components/chat/AccessGate";
import AuthGate from "@/components/auth/AuthGate";
import AppShell from "@/components/app/AppShell";

export const metadata = { title: "회원가입 | 쏠 웰니스 하우스" };

export default function SignupPage() {
  return (
    <AccessGate>
      <AuthGate initialMode="signup">
        <AppShell />
      </AuthGate>
    </AccessGate>
  );
}
