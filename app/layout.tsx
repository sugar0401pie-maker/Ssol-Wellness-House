import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Gowun_Batang } from "next/font/google";
import "./globals.css";

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
const SITE_DESCRIPTION =
  "이유없이 힘들고, 지치셨나요? GenAI 기반 웰니스 상담 채팅 '쏘웰라'에 어서오세요. 가입하시면 3일간 무료 이용권을 전달해드리니 지금 바로 마음·관계·일·삶의 방향에 대한 이야기를 나눠보세요.";

export const metadata: Metadata = {
  title: "쏠 웰니스 하우스 AI",
  description: SITE_DESCRIPTION,
  openGraph: { title: "쏠 웰니스 하우스 AI", description: SITE_DESCRIPTION, siteName: "쏠 웰니스 하우스", locale: "ko_KR", type: "website" },
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
