import Link from "next/link";
import type { Metadata } from "next";
import { uiCopy, fill } from "@/lib/engine";
import { countResults } from "@/lib/store";
import { slugFrom } from "@/lib/route";
import { TEST_SLUGS, BANNER_FILE, testName } from "@/lib/tests";

type P = { params: Promise<{ type: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { name } = await slugFrom(params);
  const t = uiCopy().tests[name];
  return { title: `${t.title} | 쏠 웰니스 하우스`, description: t.sub };
}

// /{type} — 테스트 첫 화면: 제목 + 오행 다섯 색 + 참여자 수(300명 미만이면 숨김) + [사주 보기][이전 결과 보기]
export default async function IntroPage({ params }: P) {
  const { slug, name } = await slugFrom(params);
  const c = uiCopy();
  const t = c.tests[name];
  const count = await countResults();
  return (
    <div className="pg center" style={{ paddingTop: 36 }}>
      <p className="sub">{c.intro.brand}</p>
      <h2 style={{ fontSize: 24 }}>{t.title}</h2>
      <p className="sub">{t.sub}</p>
      <div className="dots" aria-hidden>
        <i className="bg-목" />
        <i className="bg-화" />
        <i className="bg-토" />
        <i className="bg-금" />
        <i className="bg-수" />
      </div>
      <p>{t.hero_line}</p>
      {count >= 300 && <p className="sub">{fill(c.intro.participants, { count: count.toLocaleString("ko-KR") })}</p>}
      <Link className="btn" href={`/${slug}/welcome`} style={{ textDecoration: "none" }}>
        {c.intro.button}
      </Link>
      <Link className="btn ghost" href="/history" style={{ textDecoration: "none" }}>
        {c.intro.button_results}
      </Link>
      <h3 className="mt" style={{ textAlign: "left" }}>
        {c.intro.other_tests_title}
      </h3>
      <p className="hint" style={{ textAlign: "left" }}>
        {c.intro.other_tests_note}
      </p>
      {TEST_SLUGS.filter((s) => s !== slug).map((s) => (
        <Link key={s} className="testcard" href={`/${s}`} aria-label={c.tests[testName(s)].title}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BANNER_FILE[s]} alt={c.tests[testName(s)].title} />
        </Link>
      ))}
    </div>
  );
}
