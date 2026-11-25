import Image from "next/image";
import Link from "next/link";

// 앱을 처음 열 때(접속 확인 → 로그인 확인 → 내 정보 확인 → 홈 데이터) 서버 요청이 차례로 이어지는 동안
// 화면이 비어 보이지 않도록 먼저 보여주는 안내 화면(2026-10-15 owner 요청: "처음에 전체 내용 뜰 때까지 5~10초
// 걸리는데 안내문구 같은 걸 먼저 나오게"). 2026-10-16 속도 개선 뒤에는 보통 1~3초라서 "5~10초" 같은 시간 약속은 문구에서 뺐다(owner 결정: "쏘웰라를 불러오고 있어요! 잠시만 기다려 주세요").
// fullScreen이면 화면 전체(접속·로그인 확인 단계), 아니면 부모 영역 안(헤더·하단 탭은 이미 보이는 단계)을 채운다.
// 2026-11-25 대표님: 밤하늘 테마 색 + 흰 로고(앱 첫 화면과 같은 분위기).
// 서버 컴포넌트로 둬서(상태 없음) 자바스크립트가 아직 안 올라온 첫 순간에도 서버가 그대로 그려 보낸다.
// 2026-11-15 owner 요청(SEO): "/"와 "/signup"의 서버 HTML에는 이 화면밖에 없어서, 자바스크립트를 실행하지 않는 검색·AI 크롤러는 쏘웰라가 무엇인지 읽을 글도, 따라갈 링크도 찾지 못했다.
// 그래서 fullScreen(접속·로그인 확인 단계 = 크롤러가 받는 첫 HTML)일 때만 서비스 한 줄 소개와 소개·안내 링크를 같이 내려보낸다. 로딩이 끝나면 화면이 바뀌므로 이용자에게는 잠깐만 작게 보인다.
export default function AppLoading({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`ssol-night ssol-sky flex w-full flex-col items-center justify-center px-6 text-center ${fullScreen ? "h-dvh" : "h-full"}`}
    >
      <Image src="/logo-mark-white.png" alt="" width={56} height={15} priority className="h-auto w-[56px]" />
      <p className="mt-5 font-serif text-[18px] font-bold leading-7 text-foreground">
        <span className="ssol-pulse-text">쏘웰라를 불러오고 있어요!</span>
      </p>
      <p className="mt-2 text-[13px] leading-5 text-slate-500">
        <span className="ssol-pulse-text" style={{ animationDelay: "200ms" }}>
          잠시만 기다려 주세요.
        </span>
      </p>
      <p className="mt-4 text-[20px] leading-none text-navy" aria-hidden="true">
        <span className="ssol-thinking-dot" style={{ animationDelay: "0ms" }}>
          ·
        </span>
        <span className="ssol-thinking-dot" style={{ animationDelay: "150ms" }}>
          ·
        </span>
        <span className="ssol-thinking-dot" style={{ animationDelay: "300ms" }}>
          ·
        </span>
      </p>
      {fullScreen && (
        <nav aria-label="쏘웰라 소개" className="mt-10 max-w-[320px] text-[12px] leading-5 text-slate-500">
          <p>
            쏘웰라는 쏠 웰니스 하우스가 만든 AI 심리상담(비임상 웰니스 상담)이에요. 마음이 쓰이는 고민을 대화로 정리하고, 오늘 할 수 있는 작은 실천까지 이어 줘요. 의학적 진단·치료·처방은 하지 않아요.
          </p>
          <p className="mt-2">
            <Link href="/about" className="text-navy underline">
              쏘웰라 소개
            </Link>
            {" · "}
            <a href="https://www.ssolwellnesshouse.com/faq.html" className="text-navy underline">
              자주 묻는 질문
            </a>
            {" · "}
            <a href="https://www.ssolwellnesshouse.com/safety.html" className="text-navy underline">
              안전 안내
            </a>
            {" · "}
            <a href="https://www.ssolwellnesshouse.com/team.html" className="text-navy underline">
              만든 사람들
            </a>
            {" · "}
            <Link href="/legal" className="text-navy underline">
              약관·개인정보
            </Link>
          </p>
        </nav>
      )}
    </div>
  );
}
