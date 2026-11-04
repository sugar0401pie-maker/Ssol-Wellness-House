import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Gowun_Batang } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/seo/paths";

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
const SITE_TITLE = "성공과 행복 그 너머의 당신을 찾아드립니다, 웰니스 상담 플랫폼 쏘웰라 AI";
const SITE_DESCRIPTION =
  "이유없이 힘들고, 지치셨나요? GenAI 기반 웰니스 상담 채팅 '쏘웰라'에 어서오세요. 가입하시면 3일간 무료 이용권을 전달해드리니 지금 바로 마음·관계·일·삶의 방향에 대한 이야기를 나눠보세요.";

// 2026-11-03 owner 요청: 카카오톡 등으로 링크를 공유할 때 대표 이미지가 뜨게 한다. 이미지는 대표님이 정한 첫 화면 문구 이미지를
// 카카오 권장 비율(2:1)인 1200×600으로 맞춘 것(public/og-image.jpg). 이미지 주소는 절대 주소여야 해서 metadataBase를 둔다.
// 카카오톡은 한 번 읽은 링크 미리보기를 저장해 두므로, 이미지를 바꾸면 카카오 공유 디버거에서 "캐시 초기화"를 해야 바로 바뀐다.
const SHARE_IMAGE = { url: "/og-image.jpg", width: 1200, height: 600, alt: "이유 없이 '그냥' 힘드신가요? 웰니스 상담 쏘웰라" };

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: { title: SITE_TITLE, description: SITE_DESCRIPTION, siteName: "쏠 웰니스 하우스", locale: "ko_KR", type: "website", images: [SHARE_IMAGE] },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: [SHARE_IMAGE.url] },
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
