import Link from "next/link";
import { uiCopy } from "@/lib/engine";
import { TEST_SLUGS, BANNER_FILE, testName } from "@/lib/tests";

// saju.ssolwellnesshouse.com/ — 허브: 4종 테스트 고르기
export default function Hub() {
  const c = uiCopy();
  return (
    <div className="pg" style={{ paddingTop: 32 }}>
      <p className="sub center">{c.intro.brand}</p>
      {TEST_SLUGS.map((s) => {
        const t = c.tests[testName(s)];
        return (
          <Link key={s} className="testcard" href={`/${s}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BANNER_FILE[s]} alt={t.title} />
            <p className="sub" style={{ margin: "6px 2px 0" }}>
              {t.sub}
            </p>
          </Link>
        );
      })}
      <Link className="btn ghost mt" href="/history" style={{ textAlign: "center", textDecoration: "none" }}>
        {c.intro.button_results}
      </Link>
      <p className="foot">{c.disclaimer}</p>
    </div>
  );
}
