import { notFound } from "next/navigation";
import ChallengeStart from "@/components/challenge/ChallengeStart";
import { isStartKey } from "@/lib/challenge/planView";

export const metadata = { title: "챌린지 시작 | 쏠 웰니스 하우스" };

// 챌린지 시작: /challenge/start/worry · delay · energy(세 가지 마음) · me(질문 3개 답으로 엔진이 고름, ?s=셔플) · tarot(타로가 준 챌린지)
export default async function Start({ params }: { params: Promise<{ theme: string }> }) {
  const { theme } = await params;
  if (!isStartKey(theme)) notFound();
  return <ChallengeStart theme={theme} />;
}
