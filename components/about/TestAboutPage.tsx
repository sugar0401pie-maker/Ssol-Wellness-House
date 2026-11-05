import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import { SHARE_IMAGE } from "@/lib/seo/paths";
import { TAROT_BUTTON, TAROT_URL, TEST_PAGE_LIST, testPageJsonLd, type Block, type TestPage } from "@/lib/about/testPages";
import { ButtonLink, FaqItem, H2, P, Table } from "./ui";

// 테스트 소개 페이지(/about/dessert · astro · tarot)의 공통 화면. 쏘웰라 /about과 같은 방식이다:
// 로그인 없이 보이고, 본문·FAQ가 서버에서 처음부터 글자로 내려가며(자바스크립트 불필요), canonical은 각 테스트 사이트의 원본 /about이다.
// 그래서 이 주소들은 sitemap.xml에 넣지 않고(canonical 주소만 올린다), robots로도 막지 않는다. 대신 쏘웰라 /about과 서로 링크로 이어 크롤러가 찾게 한다.
export function testAboutMetadata(page: TestPage): Metadata {
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.canonical },
    openGraph: { title: page.title, description: page.description, url: page.canonical, siteName: "쏠 웰니스 하우스", locale: "ko_KR", type: "website", images: [SHARE_IMAGE] },
    twitter: { card: "summary_large_image", title: page.title, description: page.description, images: [SHARE_IMAGE.url] },
  };
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.t === "p") return <P key={i}>{b.text}</P>;
        if (b.t === "linkp")
          return (
            <P key={i}>
              {b.text}{" "}
              <a href={b.href} className="font-medium text-navy underline underline-offset-2">
                {b.linkText}
              </a>
              {b.after}
            </P>
          );
        if (b.t === "table") return <Table key={i} head={b.head} rows={b.rows} />;
        if (b.t === "ol")
          return (
            <ol key={i} className="mt-3 list-decimal space-y-1.5 pl-5 text-[14px] leading-6 text-slate-600">
              {b.items.map(([lead, text]) => (
                <li key={lead}>
                  <span className="font-medium text-foreground">{lead}</span> — {text}
                </li>
              ))}
            </ol>
          );
        return (
          <ul key={i} className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] leading-6 text-slate-600">
            {b.items.map((it) =>
              typeof it === "string" ? (
                <li key={it}>{it}</li>
              ) : (
                <li key={it[0]}>
                  <span className="font-medium text-foreground">{it[0]}</span> — {it[1]}
                </li>
              ),
            )}
          </ul>
        );
      })}
    </>
  );
}

export default function TestAboutPage({ page }: { page: TestPage }) {
  const others = TEST_PAGE_LIST.filter((p) => p.slug !== page.slug);
  return (
    <div className="min-h-dvh bg-background px-5 py-8">
      <script
        type="application/ld+json"
        // JSON 안의 "<"가 태그로 읽히지 않게 이스케이프한다
        dangerouslySetInnerHTML={{ __html: JSON.stringify(testPageJsonLd(page)).replace(/</g, "\\u003c") }}
      />
      <div className="mx-auto max-w-2xl">
        <Link href="/about" className="text-[13px] text-slate-500">
          ← 쏘웰라 소개
        </Link>

        <p className="mt-4 text-[12px] font-medium text-navy">쏠 웰니스 하우스</p>
        <h1 className="mt-1 font-serif text-[24px] font-bold leading-8 text-foreground">{page.h1}</h1>
        <P>{page.intro}</P>
        <div className="mt-5">
          <ButtonLink href={page.testUrl}>{page.testButton}</ButtonLink>
        </div>

        {page.sections.map((s) => (
          <section key={s.h2}>
            <H2>{s.h2}</H2>
            <Blocks blocks={s.blocks} />
          </section>
        ))}

        <H2>자주 묻는 질문</H2>
        {page.faq.map((g) => (
          <div key={g.group}>
            <p className="mt-5 text-[12px] font-semibold text-slate-500">{g.group}</p>
            <div className="mt-2 space-y-2">
              {g.items.map((f) => (
                <FaqItem key={f.q} q={f.q} a={f.a} />
              ))}
            </div>
          </div>
        ))}

        <H2>{page.sowellaH2}</H2>
        <P>{page.sowella}</P>
        <p className="mt-3">
          <Link href="/about" className="text-[14px] font-medium text-navy underline underline-offset-2">
            쏘웰라 자세히 보기 →
          </Link>
        </p>

        <H2>다른 테스트도 둘러보세요</H2>
        <ul className="mt-3 space-y-1.5 text-[14px] leading-6">
          {others.map((o) => (
            <li key={o.slug}>
              <Link href={`/about/${o.slug}`} className="font-medium text-navy underline underline-offset-2">
                {o.name}
              </Link>
            </li>
          ))}
        </ul>

        {/* 맨 아래 버튼(대표님 요청 2026-11-05): 페이지마다 "타로 테스트 보러 가기"와 "쏘웰라 연결"을 하나씩 단다. 이 테스트 버튼은 문서 규칙대로 그대로 두고,
            타로 페이지에서는 이 테스트 버튼이 곧 타로 테스트라 같은 버튼을 두 번 만들지 않는다. 원본 퀴즈 사이트 맨 아래도 같은 세 버튼이다. */}
        <div className="mt-10 border-t border-line pt-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <ButtonLink href={page.testUrl}>{page.testButton}</ButtonLink>
            {page.slug !== "tarot" && (
              <ButtonLink href={TAROT_URL} variant="secondary">
                {TAROT_BUTTON}
              </ButtonLink>
            )}
            <ButtonLink href="/signup" variant="secondary">
              {page.sowellaButton}
            </ButtonLink>
          </div>
          <p className="mt-6 text-[12px] leading-5 text-slate-500">{page.disclaimer}</p>
        </div>

        <SiteFooter />
      </div>
    </div>
  );
}
