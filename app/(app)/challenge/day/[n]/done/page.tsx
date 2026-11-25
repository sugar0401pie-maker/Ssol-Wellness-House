import { notFound } from "next/navigation";
import ChallengeDayCard from "@/components/challenge/ChallengeDayCard";
import { parseDay } from "@/lib/challenge/state";

export const metadata = { title: "오늘 챌린지 완료 | 쏠 웰니스 하우스" };

// 결과 화면: /challenge/day/N/done
export default async function Done({ params }: { params: Promise<{ n: string }> }) {
  const n = parseDay((await params).n);
  if (!n) notFound();
  return <ChallengeDayCard n={n} step="done" />;
}
