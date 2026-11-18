import type { Metadata } from "next";
import Link from "next/link";
import HelpResources from "@/components/help/HelpResources";
import SiteFooter from "@/components/SiteFooter";

// 도움받을 곳 안내 화면(2026-11-18 CSO 결정 — 개발 요청 v1.3 §4-1).
// 폭력·통제 관계 이야기와 깊어짐(오래 힘든 마음)으로 넘길 때, 대화에는 기관 이름·연락처를 넣지 않고 이 화면으로 넘어오게 한다.
// 로그인 없이도 볼 수 있다(누구나 언제든 찾을 수 있어야 하는 정보). 목록은 마이페이지 '도움받을 곳'과 같다.
export const metadata: Metadata = {
  title: "도움받을 곳 | 쏠 웰니스 하우스",
  description: "혼자 감당하기 벅찰 때 바로 이야기할 수 있는 곳을 모아 두었어요.",
};

export default function HelpPage() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-white px-5 py-8">
      <Link href="/chat" className="text-[13px] text-slate-500">
        ← 대화로 돌아가기
      </Link>
      <h1 className="mt-4 text-[19px] font-medium text-foreground">도움받을 곳</h1>
      <p className="mt-2 text-[14px] leading-6 text-slate-600">
        혼자 감당하기 벅찬 순간에 바로 이야기할 수 있는 곳을 모아 두었어요. 필요하다고 느낄 때 편하게 찾아보세요. 쏘웰라와의 대화도 언제든 이어서 할 수 있어요.
      </p>
      <div className="mt-6">
        <HelpResources />
      </div>
      <div className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-[13px] leading-6 text-slate-600">
        오래 힘든 마음이 이어진다면, 정신건강의학과나 지역 정신건강복지센터, 상담 기관에서 이야기를 나눠 볼 수도 있어요. 정신건강위기상담전화 1577-0199에서 가까운 정신건강복지센터를 안내받을 수 있어요.
      </div>
      <div className="mt-8">
        <SiteFooter />
      </div>
    </div>
  );
}
