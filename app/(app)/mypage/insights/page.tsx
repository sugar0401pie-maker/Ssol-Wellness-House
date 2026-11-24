import Link from "next/link";
import InsightsSection from "@/components/app/InsightsSection";

export const metadata = { title: "대화에서 읽은 것들 | 쏠 웰니스 하우스" };

// 2026-11-24 대표님 요청: 마이페이지 맨 위 카드의 "더 알아보기"로 들어오는 화면 — 쌓인 내용을 모아 보여 준다.
export default function InsightsPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="border-b border-line px-4 py-3">
        <Link href="/mypage" className="text-[14px] text-slate-500">
          ← 마이페이지
        </Link>
      </header>
      <div className="px-4 py-5">
        <InsightsSection />
      </div>
    </div>
  );
}
