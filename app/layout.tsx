import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Noto_Sans_KR, Gowun_Batang } from "next/font/google";
import "./globals.css";
import { SHARE_IMAGE, SITE_URL } from "@/lib/seo/paths";
import { OG_DESCRIPTION, OG_TITLE, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo/siteCopy";
import { GOOGLE_ADS_ID } from "@/lib/ads/googleAds";

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

// 2026-11-24 대표님 요청: 구글 광고(전환 측정)용 Google Tag Manager 컨테이너. 보내 주신 코드는 dataLayer만 만들고 GTM 시작 신호(gtm.js)가 없어
// "모든 페이지" 같은 기본 트리거가 안 걸릴 수 있어, 구글이 안내하는 표준 GTM 코드로 넣는다(화면이 그려진 뒤 불러와 첫 로딩을 늦추지 않음).
// 채팅 내용은 주소에 들어가지 않는다 — GTM에 페이지 글자를 읽는 태그를 추가하지 말 것(대화 내용이 밖으로 나갈 수 있음).
const GTM_ID = "GTM-T4G8FRKC";
// 2026-11-24 대표님 요청: 구글 광고 태그(gtag.js). 결제 전환(purchase)은 결제 완료 화면이 보낸다(lib/ads/googleAds.ts).

// 검색 결과·링크 미리보기 제목과 설명은 lib/seo/siteCopy.ts 한 곳에서 관리한다(홈 구조화 데이터도 같은 설명을 쓴다).

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
        {/* Google Tag Manager — 자바스크립트가 꺼진 환경용 */}
        <noscript>
          <iframe src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} />
        </noscript>
        {children}
        <Script id="google-ads-gtag" src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`} strategy="afterInteractive" />
        <Script id="google-ads-config" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){dataLayer.push(arguments);};gtag('js',new Date());gtag('config','${GOOGLE_ADS_ID}');`}
        </Script>
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
      </body>
    </html>
  );
}
