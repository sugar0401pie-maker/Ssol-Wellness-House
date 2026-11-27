import { shareMetadata } from "@/lib/seo/share";

// 풍등 화면(/lantern · /lantern/done · /lantern/wish)을 밖에 공유하면 "물가의 풍등" 배너(2026-11-27 대표님).
export const metadata = shareMetadata("lantern");

export default function LanternLayout({ children }: { children: React.ReactNode }) {
  return children;
}
