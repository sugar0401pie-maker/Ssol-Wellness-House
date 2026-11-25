import { notFound } from "next/navigation";
import ChallengeDayCard from "@/components/challenge/ChallengeDayCard";
import { parseDay } from "@/lib/challenge/state";

export const metadata = { title: "인증 카드 | 쏠 웰니스 하우스" };

// N일차 스토리 카드: /challenge/day/N/card
export default async function Card({ params }: { params: Promise<{ n: string }> }) {
  const n = parseDay((await params).n);
  if (!n) notFound();
  return <ChallengeDayCard n={n} step="card" />;
}
