import Link from "next/link";
import { uiCopy } from "@/lib/engine";
import { safeNext } from "@/lib/validate";

// /about-sal — 살 소개(팝업이 아니라 자기 주소). ?next=로 돌아갈 곳(고민 쓰기 또는 결과 1쪽).
export default async function AboutSal({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const to = safeNext(next, "/");
  const s = uiCopy().sal_intro;
  const toResult = to.startsWith("/result/");
  return (
    <div className="pg">
      <h2>{s.title}</h2>
      {(s.blocks as { h: string; p: string }[]).map((b) => (
        <div key={b.h}>
          <h3>{b.h}</h3>
          <p>{b.p}</p>
        </div>
      ))}
      <div className="reprow">
        {(s.examples as [string, string][]).map(([n, e]) => (
          <div key={n} className="sal">
            <b>{n}</b>
            <small>{e}</small>
          </div>
        ))}
      </div>
      <Link className="btn" href={to} style={{ textAlign: "center", textDecoration: "none" }}>
        {toResult ? s.back_to_result : s.button}
      </Link>
    </div>
  );
}
