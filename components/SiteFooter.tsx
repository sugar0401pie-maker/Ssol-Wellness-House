import Link from "next/link";

// 2026-09-25 owner 요청: quiz.ssolwellnesshouse.com 하단과 같은 사업자 정보 푸터를
// 이 앱에도 넣는다. 로그인 전 화면(LoginScreen)과 약관 페이지(app/legal)에서 재사용한다.
// extra(2026-11-24): 마이페이지에서만 같은 줄 끝에 붙이는 링크('고객의 의견'·'도움받을 곳' — 대표님 요청).
export default function SiteFooter({ extra }: { extra?: React.ReactNode } = {}) {
  return (
    <footer className="mt-8 text-center text-[11px] leading-5 text-slate-400">
      <p>
        <a href="https://ssolwellness.com" target="_blank" rel="noreferrer" className="text-navy underline">
          by 쏠 웰니스 하우스
        </a>
      </p>
      <p className="mt-1">
        <a href="/legal#privacy" className="text-navy underline">
          개인정보처리방침
        </a>{" "}
        ·{" "}
        <a href="/legal#terms" className="text-navy underline">
          이용약관
        </a>{" "}
        ·{" "}
        {/* 2026-11-05: 검색·AI 크롤러가 소개 페이지를 찾을 수 있게 하는 링크. /legal은 서버가 이 푸터를 글자로 내려보내므로 여기서 /about으로 이어진다(소개 페이지는 사이트맵에 없다).
            2026-11-23 대표님 요청으로 약관 링크와 같은 줄에 둔다. */}
        <a href="/about" className="text-navy underline">
          쏘웰라 소개
        </a>{" "}
        ·{" "}
        {/* 2026-11-25 대표님 요청: 고민 타파를 쏘웰라 소개처럼 로그인 없이 보이는 게시판으로(/board). */}
        <Link href="/board" className="text-navy underline">
          고민 타파
        </Link>
        {extra}
      </p>
      {/* 항목마다 줄바꿈 단위를 묶어(nowrap) 좁은 화면에서 "통신판매업신고번호"처럼 단어 중간에서 끊기지 않게 한다. */}
      <p className="mt-2">
        <span className="whitespace-nowrap">쏠 웰니스 하우스</span> · <span className="whitespace-nowrap">대표 김준석</span> ·{" "}
        <span className="whitespace-nowrap">사업자등록번호 572-07-03549</span> ·{" "}
        <span className="whitespace-nowrap">통신판매업신고번호 2026-서울마포-2770</span>
      </p>
      <p>서울시 마포구 독막로 100 4층 408호 · 연락처 010-2835-2263</p>
    </footer>
  );
}
