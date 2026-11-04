import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import { MAIN_SITE_ABOUT_URL, SHARE_IMAGE } from "@/lib/seo/paths";
import {
  ABOUT_DESCRIPTION,
  ABOUT_DISCLAIMER,
  ABOUT_H1,
  ABOUT_INTRO,
  ABOUT_TITLE,
  AT_A_GLANCE,
  CONCERNS,
  CONCERNS_INTRO,
  FAQ,
  FLOW_INTRO,
  FLOW_STEPS,
  HOW_TO_USE,
  NOT_DOING,
  PRICE_ROWS,
  SAFETY_HOTLINE,
  SAFETY_INTRO,
  faqJsonLd,
} from "@/lib/about/content";

// 2026-11-04 owner 요청(SEO): 메인 사이트의 상세 소개(ssowella.html)를 줄인 요약판을 앱 주소 /about에 둔다.
// 검색엔진에는 "원본은 메인 페이지"라고 canonical로 알린다(og:url도 같게). 그래서 이 주소는 sitemap.xml에 넣지 않고(canonical 주소만 올린다),
// robots로도 막지 않는다(막으면 canonical 신호를 읽을 수 없다). 로그인 없이 보이고, 본문은 서버가 처음부터 글자로 내려보낸다(자바스크립트 불필요).
export const metadata: Metadata = {
  title: ABOUT_TITLE,
  description: ABOUT_DESCRIPTION,
  alternates: { canonical: MAIN_SITE_ABOUT_URL },
  openGraph: {
    title: ABOUT_TITLE,
    description: ABOUT_DESCRIPTION,
    url: MAIN_SITE_ABOUT_URL,
    siteName: "쏠 웰니스 하우스",
    locale: "ko_KR",
    type: "website",
    images: [SHARE_IMAGE],
  },
  twitter: { card: "summary_large_image", title: ABOUT_TITLE, description: ABOUT_DESCRIPTION, images: [SHARE_IMAGE.url] },
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 border-t border-line pt-8 text-[17px] font-semibold text-foreground">{children}</h2>;
}

function Table({ head, rows }: { head?: string[]; rows: string[][] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[320px] text-left text-[13px] leading-5 text-slate-600">
        {head && (
          <thead className="bg-navy-soft text-foreground">
            <tr>
              {head.map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-t border-line first:border-t-0">
              {r.map((c, i) => (
                <td key={i} className={`px-3 py-2 align-top ${i === 0 ? "w-[34%] font-medium text-foreground" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-dvh bg-background px-5 py-8">
      <script
        type="application/ld+json"
        // JSON 안의 "<"가 태그로 읽히지 않게 이스케이프한다
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()).replace(/</g, "\\u003c") }}
      />
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-[13px] text-slate-500">
          ← 쏘웰라 홈
        </Link>

        <p className="mt-4 text-[12px] font-medium text-navy">Ssowella · AI 웰니스 상담</p>
        <h1 className="mt-1 font-serif text-[24px] font-bold leading-8 text-foreground">{ABOUT_H1}</h1>
        <p className="mt-4 text-[14px] leading-6 text-slate-600">{ABOUT_INTRO}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/signup" className="rounded-[14px] bg-navy px-5 py-3 text-[14px] font-medium text-white">
            가입하고 3일 무료로 대화하기
          </Link>
          <a href={MAIN_SITE_ABOUT_URL} className="rounded-[14px] border border-navy px-5 py-3 text-[14px] font-medium text-navy">
            쏘웰라 자세히 보기
          </a>
        </div>

        <H2>한눈에 보기</H2>
        <Table rows={AT_A_GLANCE} />

        <H2>이런 고민을 이야기할 수 있어요</H2>
        <p className="mt-3 text-[14px] leading-6 text-slate-600">{CONCERNS_INTRO}</p>
        <ul className="mt-3 space-y-1.5 text-[14px] leading-6 text-slate-600">
          {CONCERNS.map(([area, line]) => (
            <li key={area}>
              <span className="font-medium text-foreground">{area}</span> “{line}”
            </li>
          ))}
        </ul>

        <H2>어떻게 대화가 흘러가나요</H2>
        <p className="mt-3 text-[14px] leading-6 text-slate-600">{FLOW_INTRO}</p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[14px] leading-6 text-slate-600">
          {FLOW_STEPS.map(([name, text]) => (
            <li key={name}>
              <span className="font-medium text-foreground">{name}</span> — {text}
            </li>
          ))}
        </ol>

        <H2>안전 장치</H2>
        <p className="mt-3 text-[14px] leading-6 text-slate-600">{SAFETY_INTRO}</p>
        <p className="mt-3 rounded-xl border border-navy bg-navy-soft p-4 text-[14px] leading-6 text-foreground">{SAFETY_HOTLINE}</p>

        <H2>쏘웰라가 하지 않는 일</H2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] leading-6 text-slate-600">
          {NOT_DOING.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <H2>이용 방법과 요금</H2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[14px] leading-6 text-slate-600">
          {HOW_TO_USE.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
        <Table head={["이용 기간", "요금(오픈 기념 특별가)", "참고"]} rows={PRICE_ROWS} />

        <H2>자주 묻는 질문</H2>
        <div className="mt-3 space-y-4">
          {FAQ.map(({ q, a }) => (
            <div key={q}>
              <h3 className="text-[14px] font-semibold text-foreground">{q}</h3>
              <p className="mt-1 text-[14px] leading-6 text-slate-600">{a}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-line pt-8 text-center">
          <a href={MAIN_SITE_ABOUT_URL} className="text-[14px] font-medium text-navy underline underline-offset-2">
            대표 상담 이론, 만든 사람들, 더 많은 질문은 자세히 보기에서 확인하세요
          </a>
          <p className="mt-6 text-[12px] leading-5 text-slate-500">{ABOUT_DISCLAIMER}</p>
        </div>

        <SiteFooter />
      </div>
    </div>
  );
}
