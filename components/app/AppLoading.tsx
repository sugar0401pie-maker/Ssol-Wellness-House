import Image from "next/image";

// 앱을 처음 열 때(접속 확인 → 로그인 확인 → 내 정보 확인 → 홈 데이터) 서버 요청이 차례로 이어지는 동안
// 화면이 비어 보이지 않도록 먼저 보여주는 안내 화면(2026-10-15 owner 요청: "처음에 전체 내용 뜰 때까지 5~10초
// 걸리는데 안내문구 같은 걸 먼저 나오게"). 실제로 운영 서버에서 1회차 약 8초, 따뜻한 상태에서도 약 4~5초가 걸린다.
// fullScreen이면 화면 전체(접속·로그인 확인 단계), 아니면 부모 영역 안(헤더·하단 탭은 이미 보이는 단계)을 채운다.
// 서버 컴포넌트로 둬서(상태 없음) 자바스크립트가 아직 안 올라온 첫 순간에도 서버가 그대로 그려 보낸다.
export default function AppLoading({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex w-full flex-col items-center justify-center bg-background px-6 text-center ${fullScreen ? "h-dvh" : "h-full"}`}
    >
      <Image src="/logo-mark.png" alt="" width={56} height={15} priority className="h-auto w-[56px]" />
      <p className="mt-5 font-serif text-[18px] font-bold leading-7 text-foreground">쏘웰라가 준비하고 있어요</p>
      <p className="mt-2 text-[13px] leading-5 text-slate-500">
        처음 열 때는 5~10초 정도 걸릴 수 있어요.
        <br />
        잠시만 기다려 주세요.
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
    </div>
  );
}
