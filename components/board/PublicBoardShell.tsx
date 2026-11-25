import Image from "next/image";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

// 로그인 없이 보는 고민 타파 공개 게시판의 틀(2026-11-25 대표님: 쏘웰라 소개처럼 밖에서도 보이게, 화면 구성은 앱 안과 같게).
// 앱 안과 같은 밤하늘 분위기(.ssol-night) — 맨 위 "쏘웰라가 알게 된 마음"만 없다(그건 로그인한 사람의 것이라 앱 안에만).
export default function PublicBoardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ssol-night min-h-dvh">
      <div className="mx-auto max-w-md" style={{ containerType: "inline-size" }}>
        <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <Link href="/" className="flex items-center gap-1.5">
            <Image src="/logo-mark.png" alt="" width={34} height={9} className="h-auto w-[34px] brightness-0 invert" />
            <span className="text-[14px] font-medium text-foreground">쏠 웰니스 하우스</span>
          </Link>
          <Link href="/" className="rounded-full bg-night-amber px-3 py-1.5 text-[12.5px] font-bold text-night-on-amber">
            쏘웰라와 이야기하기
          </Link>
        </header>
        {children}
        <div className="px-5 pb-8">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
