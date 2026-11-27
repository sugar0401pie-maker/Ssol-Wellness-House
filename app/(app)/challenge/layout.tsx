import { shareMetadata } from "@/lib/seo/share";

// 갓생러모임(작심삼일 챌린지) 화면을 밖에 공유하면 "새싹을 함께 돌보기" 배너(2026-11-27 대표님).
export const metadata = shareMetadata("growth");

export default function ChallengeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
