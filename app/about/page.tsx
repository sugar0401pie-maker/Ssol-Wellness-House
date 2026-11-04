import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import { MAIN_SITE_ABOUT_URL, SHARE_IMAGE } from "@/lib/seo/paths";
import * as C from "@/lib/about/content";

// 2026-11-04 owner 요청(SEO): 메인 사이트의 쏘웰라 상세 소개(ssowella.html)와 같은 내용을 앱 주소 /about에 따로 둔다(별도 페이지).
// 검색엔진에는 "같은 내용의 원본은 메인 사이트 쪽"이라고 canonical로 알린다(og:url도 같게) — 중복 페이지로 보지 않게 하려는 것이다.
// 그래서 이 주소는 sitemap.xml에 넣지 않고(canonical 주소만 올린다), robots로도 막지 않는다(막으면 canonical 신호를 읽을 수 없다).
// 로그인 없이 보이고, 본문은 서버가 처음부터 글자로 내려보낸다(자바스크립트 불필요).
export const metadata: Metadata = {
  title: C.ABOUT_TITLE,
  description: C.ABOUT_DESCRIPTION,
  alternates: { canonical: MAIN_SITE_ABOUT_URL },
  openGraph: {
    title: C.ABOUT_TITLE,
    description: C.ABOUT_DESCRIPTION,
    url: MAIN_SITE_ABOUT_URL,
    siteName: "쏠 웰니스 하우스",
    locale: "ko_KR",
    type: "website",
    images: [SHARE_IMAGE],
  },
  twitter: { card: "summary_large_image", title: C.ABOUT_TITLE, description: C.ABOUT_DESCRIPTION, images: [SHARE_IMAGE.url] },
};

const WELLNESS_SESSION_URL = "https://www.ssolwellness.com/wellnessintro";
const QUIZ_URL = "https://quiz.ssolwellnesshouse.com?utm_source=app";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 border-t border-line pt-8 text-[17px] font-semibold text-foreground">{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 text-[15px] font-semibold text-foreground">{children}</h3>;
}

function P({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`mt-3 text-[14px] leading-6 text-slate-600 ${className}`}>{children}</p>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 inline-block rounded-full bg-navy-soft px-3 py-1 text-[12px] font-medium text-navy">{children}</p>;
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
                <td key={i} className={`px-3 py-2 align-top ${i === 0 ? "font-medium text-foreground" : ""}`}>
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

function LabeledList({ rows }: { rows: [string, string][] }) {
  return (
    <ul className="mt-3 space-y-2 text-[14px] leading-6 text-slate-600">
      {rows.map(([name, text]) => (
        <li key={name}>
          <span className="font-medium text-foreground">{name}</span> — {text}
        </li>
      ))}
    </ul>
  );
}

function StartButton() {
  return (
    <Link href="/signup" className="inline-block rounded-[14px] bg-navy px-5 py-3 text-[14px] font-medium text-white">
      가입하고 3일 무료로 대화하기
    </Link>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-dvh bg-background px-5 py-8">
      <script
        type="application/ld+json"
        // JSON 안의 "<"가 태그로 읽히지 않게 이스케이프한다
        dangerouslySetInnerHTML={{ __html: JSON.stringify(C.faqJsonLd()).replace(/</g, "\\u003c") }}
      />
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-[13px] text-slate-500">
          ← 쏘웰라 홈
        </Link>

        <p className="mt-4 text-[12px] font-medium text-navy">Ssowella · AI 웰니스 상담</p>
        <h1 className="mt-1 font-serif text-[24px] font-bold leading-8 text-foreground">{C.ABOUT_H1}</h1>
        <P>{C.ABOUT_INTRO}</P>
        <div className="mt-5">
          <StartButton />
        </div>
        <p className="mt-3 text-[12px] text-slate-500">{C.ABOUT_UPDATED}</p>

        <H2>한눈에 보기</H2>
        <Table rows={C.AT_A_GLANCE} />

        <H2>이런 고민을 이야기할 수 있어요</H2>
        <P>{C.CONCERNS_INTRO}</P>
        <ul className="mt-3 space-y-1.5 text-[14px] leading-6 text-slate-600">
          {C.CONCERNS.map(([area, line]) => (
            <li key={area}>
              <span className="font-medium text-foreground">{area}</span> “{line}”
            </li>
          ))}
        </ul>
        <P>{C.CONCERNS_OUTRO}</P>

        <H2>어떻게 대화가 흘러가나요</H2>
        <P>{C.FLOW_INTRO}</P>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[14px] leading-6 text-slate-600">
          {C.FLOW_STEPS.map(([name, text]) => (
            <li key={name}>
              <span className="font-medium text-foreground">{name}</span> — {text}
            </li>
          ))}
        </ol>

        <H2>대화 예시</H2>
        <Label>{C.EXAMPLE_LABEL}</Label>
        <blockquote className="mt-3 space-y-2 rounded-xl border border-line bg-white p-4 text-[14px] leading-6 text-slate-600">
          {C.EXAMPLE_DIALOGUE.map(([who, text]) => (
            <p key={who}>
              <span className="font-semibold text-foreground">{who}</span> {text}
            </p>
          ))}
        </blockquote>
        <P>{C.EXAMPLE_NOTE}</P>
        <H3>커리어 사례</H3>
        <Label>{C.CAREER_LABEL}</Label>
        <P>{C.CAREER_TEXT}</P>

        <H2>내 상태에 맞춰 단계별로 제안해요</H2>
        <P>{C.STEPS_INTRO}</P>
        <Table head={["영역", "약한 실천 → 강한 실천"]} rows={C.STEP_ROWS} />

        <H2>나를 기억하는 방식</H2>
        <P>{C.MEMORY_TEXT}</P>

        <H2>무엇을 근거로 하나요</H2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] leading-6 text-slate-600">
          {C.BASIS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <H3>대표 상담 이론</H3>
        <P>{C.THEORY_INTRO}</P>
        <Table head={["대표 이론", "주로 맞는 고민 영역"]} rows={C.THEORY_ROWS} />

        <H2>안전 장치</H2>
        <P>{C.SAFETY_INTRO}</P>
        <Table head={["이용자가 이렇게 말하면", "쏘웰라는"]} rows={C.SAFETY_ROWS} />
        <p className="mt-4 rounded-xl border border-navy bg-navy-soft p-4 text-[14px] leading-6 text-foreground">{C.SAFETY_HOTLINE}</p>

        <H2>쏘웰라가 하지 않는 일</H2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] leading-6 text-slate-600">
          {C.NOT_DOING.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <H2>이용 방법과 요금</H2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[14px] leading-6 text-slate-600">
          {C.HOW_TO_USE.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
        <Table head={["이용 기간", "요금(오픈 기념 특별가)", "참고"]} rows={C.PRICE_ROWS} />
        <div className="mt-4">
          <StartButton />
        </div>

        <H2>사람 상담사와 이어져요</H2>
        <P>{C.HUMAN_TEXT}</P>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] leading-6 text-slate-600">
          {C.HUMAN_BULLETS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="mt-3">
          <a href={WELLNESS_SESSION_URL} className="text-[14px] font-medium text-navy underline underline-offset-2">
            멘탈 웰니스 세션이 궁금하다면 →
          </a>
        </p>

        <H2>만든 사람들</H2>
        <div className="mt-3 space-y-3">
          {C.MAKERS.map((m) => (
            <div key={m.name} className="rounded-xl border border-line bg-white p-4">
              <p className="text-[15px] font-semibold text-foreground">{m.name}</p>
              <p className="text-[13px] text-slate-500">{m.title}</p>
              <dl className="mt-2 space-y-1 text-[13px] leading-5 text-slate-600">
                {m.items.map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-10 shrink-0 font-medium text-foreground">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        <H2>{C.LIMITS_TITLE}</H2>
        <P>{C.LIMITS_INTRO}</P>
        <H3>사주·타로의 한계</H3>
        <LabeledList rows={C.TAROT_LIMITS} />
        <H3>심리치료로는 해결되지 않던 고민</H3>
        <P>{C.THERAPY_GAPS_INTRO}</P>
        <LabeledList rows={C.THERAPY_GAPS} />
        <H3>쏘웰라 AI 웰니스 상담은 이렇게 풀어요</H3>
        <LabeledList rows={C.SOLUTIONS} />

        <H2>쏘웰라와 심리치료, 사주·타로는 무엇이 다른가요</H2>
        <P>{C.COMPARE_INTRO}</P>
        <Table head={C.COMPARE_HEAD} rows={C.COMPARE_ROWS} />
        <p className="mt-2 text-[12px] text-slate-500">{C.TABLE_SCROLL_HINT}</p>
        <H3>{C.COMPARE_AI_TITLE}</H3>
        <Table head={C.COMPARE_AI_HEAD} rows={C.COMPARE_AI_ROWS} />

        <H2>자주 묻는 질문</H2>
        <div className="mt-3 space-y-4">
          {C.FAQ.map(({ q, a }) => (
            <div key={q}>
              <h3 className="text-[14px] font-semibold text-foreground">{q}</h3>
              <p className="mt-1 text-[14px] leading-6 text-slate-600">{a}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-line pt-8 text-center">
          <h2 className="font-serif text-[18px] font-bold text-foreground">{C.CLOSING_TITLE}</h2>
          <div className="mt-4 flex flex-col items-center gap-3">
            <StartButton />
            <a href={QUIZ_URL} className="rounded-[14px] border border-navy px-5 py-3 text-[14px] font-medium text-navy">
              웰니스 테스트부터 해보기
            </a>
            <Link href="/" className="text-[13px] text-slate-500">
              ← 쏠 웰니스 하우스 홈으로
            </Link>
          </div>
          <p className="mt-6 text-[12px] leading-5 text-slate-500">{C.ABOUT_DISCLAIMER}</p>
        </div>

        <SiteFooter />
      </div>
    </div>
  );
}
