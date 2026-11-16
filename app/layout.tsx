import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Gowun_Batang } from "next/font/google";
import "./globals.css";
import { SHARE_IMAGE, SITE_URL } from "@/lib/seo/paths";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// 2026-09-28: owner 디자인 시안의 제목용 서체(견출명조 계열). 본문은 그대로 Noto Sans KR.
const gowunBatang = Gowun_Batang({
  variable: "--font-gowun-batang",
  subsets: ["latin"],
  weight: ["400", "700"],
});

// 검색 결과(네이버 등)와 링크 미리보기에 보이는 제목·설명. 2026-10-21 대표님이 직접 정한 소개 문구로 바꿈(이전 설명에는 "의료서비스가 아니며
// 진단·치료를 대신하지 않습니다"가 들어 있었다 — 서비스 안의 안내·약관에는 그대로 있다). 검색 결과 반영은 검색엔진이 다시 읽어 가야 해서 며칠 걸린다.
// 2026-11-04 대표님이 제목·설명을 다시 정해 줌(아래 값 그대로 — 검색 서비스의 "페이지 제목/설명" 항목에 맞춘 문구).
// 2026-11-16 대표님이 검색·AI 크롤러용 제목·설명을 다시 정함. 링크 공유 미리보기(og)는 검색용과 문구가 달라서 따로 둔다.
const SITE_TITLE = "쏘웰라 AI | 내 손안의 상담사, AI 심리상담 3일 무료";
const SITE_DESCRIPTION =
  "이유없이 힘들고, 지치셨나요? 내 손안의 상담사, 쏘웰라 AI에 어서오세요. 전문 심리상담사가 설계한 GenAI 웰니스 상담 채팅이에요. 가입하시면 3일간 무료 이용권을 드리니 지금 바로 마음·관계·일·삶의 방향에 대한 이야기를 나눠 보세요.";
const OG_TITLE = "내 손안의 상담사, 쏘웰라 AI | 가입하면 3일 무료";
const OG_DESCRIPTION = "털어놓기 어려운 고민, 쏘웰라에게 먼저 이야기해 보세요. 가입하면 3일 무료. 전문 심리상담사가 설계한 AI 상담이 원인을 함께 좁히고 이번 주 실천까지 정리해 줘요.";

// 2026-11-03 owner 요청: 카카오톡 등으로 링크를 공유할 때 대표 이미지가 뜨게 한다. 이미지는 대표님이 정한 첫 화면 문구 이미지를
// 카카오 권장 비율(2:1)인 1200×600으로 맞춘 것(public/og-image.jpg). 이미지 주소는 절대 주소여야 해서 metadataBase를 둔다.
// 카카오톡은 한 번 읽은 링크 미리보기를 저장해 두므로, 이미지를 바꾸면 카카오 공유 디버거에서 "캐시 초기화"를 해야 바로 바뀐다.

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: { title: OG_TITLE, description: OG_DESCRIPTION, siteName: "쏠 웰니스 하우스", locale: "ko_KR", type: "website", images: [SHARE_IMAGE] },
  twitter: { card: "summary_large_image", title: OG_TITLE, description: OG_DESCRIPTION, images: [SHARE_IMAGE.url] },
  // 사이트 소유 확인용 태그(비밀 값 아님). 인증이 끝난 뒤에도 지우면 확인이 풀리니 그대로 둔다.
  //  - 2026-11-03 Bing 웹마스터 도구(msvalidate.01)
  //  - 2026-11-04 네이버 서치어드바이저(naver-site-verification)
  verification: {
    other: {
      "msvalidate.01": "5F7F74F02C08FB70A6A250B0DB0A7ADF",
      "naver-site-verification": "f192301c52bc33d97b664bd81faff6a2d30a3f71",
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#033667",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} ${gowunBatang.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* 2026-11-15: 앱 첫 화면(/)은 로그인 확인이 끝나야 그려져서, 서버 HTML에는 "불러오고 있어요" 문구뿐이다. 자바스크립트를 실행하지 않는 크롤러(검색·AI)가
            소개 페이지를 찾을 수 있게, 자바스크립트가 꺼진 환경에서만 보이는 링크 모음을 둔다(자바스크립트가 켜진 일반 사용자 화면에는 나오지 않는다). */}
        <noscript>
          <p style={{ padding: 16 }}>
            쏘웰라는 쏠 웰니스 하우스의 AI 심리상담 서비스예요. <a href="/about">쏘웰라 소개</a> · <a href="/about/dessert">디저트 웰니스 유형 테스트</a> · <a href="/about/astro">쏠 아스트로 하우스</a> ·{" "}
            <a href="/about/tarot">쏠 타로 하우스</a> · <a href="https://www.ssolwellnesshouse.com/about.html">쏘웰라 자세한 소개</a> · <a href="https://www.ssolwellnesshouse.com/faq.html">자주 묻는 질문</a> ·{" "}
            <a href="https://www.ssolwellnesshouse.com/safety.html">안전 안내</a> · <a href="/legal">약관과 정책</a> · <a href="/signup">3일 무료로 시작하기</a>
          </p>
        </noscript>
        {children}
      </body>
    </html>
  );
}
