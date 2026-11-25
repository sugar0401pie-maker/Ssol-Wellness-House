import { notFound } from "next/navigation";
import ChallengeCheckin from "@/components/challenge/ChallengeCheckin";
import { parseDay } from "@/lib/challenge/state";

export const metadata = { title: "오늘의 인증 | 쏠 웰니스 하우스" };

// 인증하는 화면: /challenge/day/1 · 2 · 3
export default async function Day({ params }: { params: Promise<{ n: string }> }) {
  const n = parseDay((await params).n);
  if (!n) notFound();
  return <ChallengeCheckin n={n} />;
}
