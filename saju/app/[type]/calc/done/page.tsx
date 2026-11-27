import Link from "next/link";
import { notFound } from "next/navigation";
import { uiCopy, fill } from "@/lib/engine";
import { slugFrom } from "@/lib/route";
import { getResult, isResultId } from "@/lib/store";

// .pillars는 시안 CSS에서 direction:rtl — 연주가 오른쪽 끝, 시주가 왼쪽 끝으로 놓인다(전통 표기)
const POS = [
  ["year", "연주"],
  ["month", "월주"],
  ["day", "일주"],
  ["hour", "시주"],
] as const;

// /{type}/calc/done?result=… — 계산 끝 화면. v1.3.0부터 대표 살은 보여 주지 않고 네 기둥만(ui_copy.calc.done_note).
export default async function CalcDonePage({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<{ result?: string }> }) {
  const { slug } = await slugFrom(params);
  const { result } = await searchParams;
  const r = result && isResultId(result) ? await getResult(result) : null;
  if (!r || r.slug !== slug) notFound();
  const c = uiCopy().calc;
  const p = r.page.pillars ?? {};
  return (
    <div className="pg center" style={{ paddingTop: 32 }}>
      <h2>{fill(c.done, { nickname: r.nickname })}</h2>
      <p className="sub">{c.done_sub}</p>
      <div className="pillars">
        {POS.map(([k, ko]) => (
          <div key={k} className={`pil${k === "day" ? " day" : ""}`}>
            <small>{ko}</small>
            <div className="ch">{p[k] ? p[k].stem : "?"}</div>
            <div className="ch">{p[k] ? p[k].branch : "?"}</div>
          </div>
        ))}
      </div>
      {r.timeNote && <p className="hint">{r.timeNote}</p>}
      <Link className="btn" href={`/${slug}/loading?result=${r.id}`} style={{ textDecoration: "none" }}>
        {c.button}
      </Link>
    </div>
  );
}
