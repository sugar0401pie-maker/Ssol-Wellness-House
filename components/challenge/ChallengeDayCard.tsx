"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { seaArtFor } from "@/lib/challenge/seaArt";
import CardScreen from "./CardScreen";
import ResultScreen from "./ResultScreen";
import { ChallengeShell, Loading } from "./ChallengeParts";
import {
  challengePaths,
  clearFreshCard,
  dayCardMaker,
  readFreshCard,
  useChallenge,
} from "./useChallenge";

// N일차 스토리 카드(/challenge/day/N/card)와 그 뒤 결과 화면(/challenge/day/N/done) — 지금 챌린지에 N일차 기록이 있을 때만.
// 방금 저장한 날이면 카드를 한 번 자동 저장하고, 공유가 끝나면 결과 화면 주소로 넘어간다. 기록이 없으면 갓생러모임 첫 화면으로.
export default function ChallengeDayCard({
  n,
  step,
}: {
  n: number;
  step: "card" | "done";
}) {
  const router = useRouter();
  const { data, error } = useChallenge();
  const c = data?.current ?? null;
  const ck = c?.checkins.find((x) => x.n === n) ?? null;
  // 자동 저장 여부는 처음 열 때 한 번 읽고, 표시는 바로 지운다(새로고침해도 다시 내려받지 않게).
  const [freshKey] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readFreshCard(),
  );
  const fresh = !!c && freshKey === `${c.id}:${n}`;

  useEffect(() => {
    if (!data) return;
    if (!c || !ck) {
      router.replace(challengePaths.hub);
      return;
    }
    clearFreshCard();
  }, [data, c, ck, n, step, router]);

  if (!data || !c || !ck) {
    return (
      <ChallengeShell>
        <Loading error={error} />
      </ChallengeShell>
    );
  }
  if (step === "done")
    return <ResultScreen n={n} art={seaArtFor(`${c.id}:${n}:result`)} reward={n >= 3 ? data.reward : null} />;
  return (
    <CardScreen
      title={`갓생살기 ${n}일차 달성!`}
      autoSave={fresh}
      fileName={`ssol-challenge-day${n}.png`}
      make={dayCardMaker(c.id, ck)}
      shareText={ck.memo ?? ""}
      onShared={fresh ? () => router.push(challengePaths.done(n)) : undefined}
      onBack={() => {
        clearFreshCard();
        router.push(challengePaths.hub);
      }}
    />
  );
}
