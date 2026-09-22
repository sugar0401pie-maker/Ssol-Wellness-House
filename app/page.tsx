import AccessGate from "@/components/chat/AccessGate";
import AuthGate from "@/components/auth/AuthGate";
import AppShell from "@/components/app/AppShell";

export default function Home() {
  return (
    <AccessGate>
      <AuthGate>
        <AppShell />
      </AuthGate>
    </AccessGate>
  );
}
