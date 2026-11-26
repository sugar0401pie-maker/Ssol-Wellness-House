import { notFound } from "next/navigation";
import ChallengeQuestions from "@/components/challenge/ChallengeQuestions";
import { parseDay } from "@/lib/challenge/state";

export const metadata = { title: "나에게 맞는 챌린지 찾기 | 쏠 웰니스 하우스" };

// 나에게 맞는 챌린지 찾기 질문 3개: /challenge/questions/1 · 2 · 3 (2026-11-26 — 화면마다 주소)
export default async function Questions({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const step = parseDay(n); // "1"·"2"·"3"만
  if (!step) notFound();
  return <ChallengeQuestions step={step} />;
}
