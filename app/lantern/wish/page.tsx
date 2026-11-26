import AccessGate from "@/components/chat/AccessGate";
import AuthGate from "@/components/auth/AuthGate";
import LanternPage from "@/components/lantern/LanternPage";

export const metadata = { title: "내 소원 다시 보기 | 쏠 웰니스 하우스" };

// 날린 소원 다시 보기·고치기(대표님 2026-11-26) — 같은 화면 부품. 아직 안 날렸거나 기간이 지났으면 맞는 화면으로 주소를 돌린다.
export default function LanternWish() {
  return (
    <AccessGate>
      <AuthGate>
        <LanternPage />
      </AuthGate>
    </AccessGate>
  );
}
