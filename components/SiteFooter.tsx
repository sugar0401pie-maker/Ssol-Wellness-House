// 2026-09-25 owner 요청: quiz.ssolwellnesshouse.com 하단과 같은 사업자 정보 푸터를
// 이 앱에도 넣는다. 로그인 전 화면(LoginScreen)과 약관 페이지(app/legal)에서 재사용한다.
export default function SiteFooter() {
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
        </a>
      </p>
      <p className="mt-2">쏠 웰니스 하우스 · 대표 김준석 · 사업자등록번호 572-07-03549</p>
      <p>서울시 마포구 독막로 100 4층 408호 · 연락처 010-2835-2263</p>
    </footer>
  );
}
