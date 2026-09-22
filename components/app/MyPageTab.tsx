"use client";

// 자리표시자(placeholder) — 다음 체크포인트에서 "내 유형 열람 / 결과보고서 / 내 정보 / 상담사 연결"로 채운다.
export default function MyPageTab() {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line px-4 py-3">
        <p className="text-[15px] font-medium text-foreground">마이페이지</p>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 text-center text-[14px] text-slate-400">
        준비 중이에요. 곧 내 유형, 결과보고서, 내 정보, 상담사 연결이 여기 나타나요.
      </div>
    </div>
  );
}
