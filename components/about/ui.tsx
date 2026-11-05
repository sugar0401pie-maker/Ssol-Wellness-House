// /about 계열 소개 페이지(쏘웰라·디저트·아스트로·타로)가 같이 쓰는 화면 부품. 모두 서버 컴포넌트라 자바스크립트 없이 본문이 HTML에 들어간다.
import Link from "next/link";

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 border-t border-line pt-8 text-[17px] font-semibold text-foreground">{children}</h2>;
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 text-[15px] font-semibold text-foreground">{children}</h3>;
}

export function P({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`mt-3 text-[14px] leading-6 text-slate-600 ${className}`}>{children}</p>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 inline-block rounded-full bg-navy-soft px-3 py-1 text-[12px] font-medium text-navy">{children}</p>;
}

export function Table({ head, rows }: { head?: string[]; rows: string[][] }) {
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

export function LabeledList({ rows }: { rows: [string, string][] }) {
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

// 접고 펼치기는 브라우저 기본 <details>를 쓴다 — 자바스크립트 없이 동작하고, 접힌 답변도 HTML에 그대로 있어 검색엔진·AI 검색이 읽는다.
export function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-line bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <h3 className="text-[14px] font-semibold leading-5 text-foreground">{q}</h3>
        <span aria-hidden className="shrink-0 text-slate-400 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <p className="border-t border-line px-4 py-3 text-[14px] leading-6 text-slate-600">{a}</p>
    </details>
  );
}

const PRIMARY = "inline-block rounded-[14px] bg-navy px-5 py-3 text-center text-[14px] font-medium text-white";
const SECONDARY = "inline-block rounded-[14px] border border-navy px-5 py-3 text-center text-[14px] font-medium text-navy";

// 앱 안 이동(회원가입 등)은 Link, 다른 사이트(퀴즈·아스트로·타로)는 일반 링크(<a>)로 건다. 크롤러가 따라갈 수 있게 모두 실제 링크다.
export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" }) {
  const cls = variant === "primary" ? PRIMARY : SECONDARY;
  return href.startsWith("/") ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <a href={href} className={cls}>
      {children}
    </a>
  );
}
