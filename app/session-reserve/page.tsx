import AccessGate from "@/components/chat/AccessGate";
import AuthGate from "@/components/auth/AuthGate";
import SessionReservePage from "@/components/app/SessionReservePage";

export const metadata = { title: "웰니스 상담 신청 | 쏠 웰니스 하우스" };

export default function SessionReserve() {
  return (
    <AccessGate>
      <AuthGate>
        <SessionReservePage />
      </AuthGate>
    </AccessGate>
  );
}
