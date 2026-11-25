import AccessGate from "@/components/chat/AccessGate";
import AuthGate from "@/components/auth/AuthGate";
import LanternPage from "@/components/lantern/LanternPage";

export const metadata = { title: "풍등이 날아갔어요 | 쏠 웰니스 하우스" };

// 풍등을 날린 뒤 화면(축하 그림 + 지금 높이) — 자기 주소(대표님 2026-11-25). 같은 화면 부품을 쓰고, 아직 안 날렸으면 쓰기 화면(/lantern)으로 주소를 돌린다.
export default function LanternDone() {
  return (
    <AccessGate>
      <AuthGate>
        <LanternPage />
      </AuthGate>
    </AccessGate>
  );
}
