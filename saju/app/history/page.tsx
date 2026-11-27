import Link from "next/link";
import { uiCopy } from "@/lib/engine";
import { TEST_SLUGS, testName } from "@/lib/tests";
import HistoryList from "@/components/common/HistoryList";

// /history — 이전 결과 보기
export default function History() {
  const c = uiCopy();
  const titles = Object.fromEntries(TEST_SLUGS.map((s) => [s, c.tests[testName(s)].title]));
  return (
    <div className="pg">
      <h2>{c.intro.button_results}</h2>
      <HistoryList titles={titles} empty="-" />
      <Link className="btn ghost mt" href="/" style={{ textAlign: "center", textDecoration: "none" }}>
        {c.intro.button}
      </Link>
    </div>
  );
}
