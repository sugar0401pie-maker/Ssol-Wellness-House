"use client";

import { useRouter } from "next/navigation";

// 2026-09-27: "오프라인 웰니스 패키지 알아보기" 버튼이 연결되는 자리만 우선 만들어둔다(owner
// 요청: "지금은 페이지만 할당해주길 바래"). 줌으로 진행되는 웰니스 세션 패키지 소개 페이지는
// 별도로 만들 예정 — 내용은 그때 이 페이지에 채운다.
export default function PackagesPage() {
  const router = useRouter();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 py-10 text-center">
      <p className="text-[16px] font-medium text-foreground">오프라인 웰니스 패키지</p>
      <p className="mt-2 text-[14px] leading-6 text-slate-500">
        줌으로 진행되는 전문 웰니스 세션 패키지를 소개하는 페이지를 준비하고 있어요.
        <br />
        곧 만나요!
      </p>
      <button
        type="button"
        onClick={() => router.push("/")}
        className="mt-8 h-11 w-full max-w-xs rounded-xl bg-navy text-sm font-medium text-white"
      >
        앱으로 돌아가기
      </button>
    </div>
  );
}
