import { notFound } from "next/navigation";
import ChallengeStart from "@/components/challenge/ChallengeStart";
import { isThemeKey } from "@/lib/challenge/themes";

export const metadata = { title: "챌린지 시작 | 쏠 웰니스 하우스" };

// 챌린지 시작: /challenge/start/worry · delay · energy
export default async function Start({ params }: { params: Promise<{ theme: string }> }) {
  const { theme } = await params;
  if (!isThemeKey(theme)) notFound();
  return <ChallengeStart theme={theme} />;
}
