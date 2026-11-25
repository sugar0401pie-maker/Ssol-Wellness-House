import AccessGate from "@/components/chat/AccessGate";
import AuthGate from "@/components/auth/AuthGate";
import LanternPage from "@/components/lantern/LanternPage";

export const metadata = { title: "풍등 날리기 | 쏠 웰니스 하우스" };

// 풍등 날리기(2026-11-25, 홈 화면 개편 요청문 v1.9.4 2장·14-2장). 풍등에 집중하는 화면이라 하단 메뉴(AppFrame) 밖에 둔다(8-3장).
export default function Lantern() {
  return (
    <AccessGate>
      <AuthGate>
        <LanternPage />
      </AuthGate>
    </AccessGate>
  );
}
