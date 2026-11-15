import Link from "next/link";
import { moreLinkGroups, type PageKey } from "@/lib/about/links";
import { H2 } from "./ui";

// 소개 페이지 맨 아래 가까이에 두는 "더 알아보기" 링크 모음(대표님 요청 2026-11-15: 링크는 전부 달아 달라).
// 앱 안 이동은 Link, 다른 사이트(메인·원본)는 일반 링크(<a>)다. 크롤러가 따라갈 수 있게 모두 실제 링크다.
export default function MoreLinks({ current }: { current: PageKey }) {
  return (
    <nav aria-label="더 알아보기">
      <H2>더 알아보기</H2>
      {moreLinkGroups(current).map((g) => (
        <div key={g.title}>
          <p className="mt-5 text-[12px] font-semibold text-slate-500">{g.title}</p>
          <ul className="mt-2 space-y-1.5 text-[14px] leading-6">
            {g.items.map((it) => (
              <li key={it.href}>
                {it.href.startsWith("/") ? (
                  <Link href={it.href} className="font-medium text-navy underline underline-offset-2">
                    {it.label}
                  </Link>
                ) : (
                  <a href={it.href} className="font-medium text-navy underline underline-offset-2">
                    {it.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
