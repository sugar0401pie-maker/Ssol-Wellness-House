import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Gowun_Batang } from "next/font/google";
import "./globals.css";

// 사주 화면 서체: 제목 Gowun Batang, 본문 Noto Sans KR(설계 패키지 '새벽 한지 + 오행 다섯 색').
const noto = Noto_Sans_KR({ variable: "--font-noto", subsets: ["latin"], weight: ["400", "500", "700"] });
const gowun = Gowun_Batang({ variable: "--font-gowun", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://saju.ssolwellnesshouse.com"),
  title: "살로 풀어보는 2027년 사주 | 쏠 웰니스 하우스",
  description: "내가 가진 살로 읽는 2027년 — 연애운, 직장운, 재물운, 종합사주.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#FBF6EC" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${noto.variable} ${gowun.variable}`}>
      <body>
        <div className="app">{children}</div>
      </body>
    </html>
  );
}
