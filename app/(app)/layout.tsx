import AccessGate from "@/components/chat/AccessGate";
import AuthGate from "@/components/auth/AuthGate";
import AppFrame from "@/components/app/AppFrame";

// 2026-09-28: 홈("/home")·채팅("/chat")·마이페이지("/mypage")가 공유하는 레이아웃 — 로그인/접속코드
// 확인과 헤더·하단 탭바(AppFrame)를 여기서 한 번만 마운트한다. 탭을 오갈 때 Next.js가 이
// 레이아웃은 그대로 두고 각 페이지(page.tsx)만 바꿔 끼우므로, 매번 다시 로그인 확인을 하거나
// 헤더가 깜빡이지 않는다.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccessGate>
      <AuthGate>
        <AppFrame>{children}</AppFrame>
      </AuthGate>
    </AccessGate>
  );
}
