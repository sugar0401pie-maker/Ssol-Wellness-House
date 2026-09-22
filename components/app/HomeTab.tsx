"use client";

// 자리표시자(placeholder) — 다음 체크포인트에서 "안녕하세요 인사 + 오늘의 실천방법 제안"으로 채운다.
export default function HomeTab() {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line px-4 py-3">
        <p className="text-[15px] font-medium text-foreground">홈</p>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 text-center text-[14px] text-slate-400">
        준비 중이에요. 곧 인사말과 오늘의 실천방법 제안이 여기 나타나요.
      </div>
    </div>
  );
}
