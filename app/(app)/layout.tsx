import AccessGate from "@/components/chat/AccessGate";
import AuthGate from "@/components/auth/AuthGate";
import AppFrame from "@/components/app/AppFrame";
import { HOME_CRAWLER_INTRO, homeJsonLd } from "@/lib/seo/siteCopy";

// 2026-09-28: 홈("/home")·채팅("/chat")·마이페이지("/mypage")가 공유하는 레이아웃 — 로그인/접속코드
// 확인과 헤더·하단 탭바(AppFrame)를 여기서 한 번만 마운트한다. 탭을 오갈 때 Next.js가 이
// 레이아웃은 그대로 두고 각 페이지(page.tsx)만 바꿔 끼우므로, 매번 다시 로그인 확인을 하거나
// 헤더가 깜빡이지 않는다.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* 2026-11-21: 홈("/")의 서버 HTML에는 로딩 문구뿐이라, 검색·AI 크롤러가 읽을 서비스 정보(구조화 데이터)와 소개 글을 같이 내려보낸다.
          소개 글은 자바스크립트가 꺼진 환경에서만 보인다(일반 사용자 화면은 그대로). /home·/chat 등은 robots로 막혀 있어 홈에서만 의미가 있다. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd()).replace(/</g, "\\u003c") }} />
      <noscript>
        <div style={{ padding: 16 }}>
          {HOME_CRAWLER_INTRO.map((t) => (
            <p key={t}>{t}</p>
          ))}
        </div>
      </noscript>
      <AccessGate>
        <AuthGate>
          <AppFrame>{children}</AppFrame>
        </AuthGate>
      </AccessGate>
    </>
  );
}
