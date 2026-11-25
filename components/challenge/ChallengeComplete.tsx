"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { drawCompleteCard, notoFamily } from "@/lib/challenge/card";
import { loadThumb } from "@/lib/challenge/photos";
import { seaArtFor } from "@/lib/challenge/seaArt";
import CardScreen from "./CardScreen";
import { ChallengeShell, Loading } from "./ChallengeParts";
import { challengePaths, useChallenge } from "./useChallenge";

// 3일 모두 완료 카드(/challenge/complete) — 지금 챌린지가 3일을 다 채웠을 때만. 아니면 갓생러모임 첫 화면으로.
export default function ChallengeComplete() {
  const router = useRouter();
  const { data, error } = useChallenge();
  const c = data?.current ?? null;
  const ok = data?.view.kind === "complete" && !!c;

  useEffect(() => {
    if (data && !ok) router.replace(challengePaths.hub);
  }, [data, ok, router]);

  if (!ok || !c) {
    return (
      <ChallengeShell>
        <Loading error={error} />
      </ChallengeShell>
    );
  }
  return (
    <CardScreen
      title="와! 3일차 챌린지를 완료했어요!"
      autoSave={false}
      fileName="ssol-challenge-complete.png"
      make={() =>
        drawCompleteCard(
          c.checkins.map((ck) => ({
            n: ck.n,
            thumbUrl: ck.method === "photo" ? loadThumb(c.id, ck.n) : null,
            artUrl: seaArtFor(`${c.id}:${ck.n}`),
            text: ck.memo || ck.action,
          })),
          notoFamily(),
        )
      }
      shareText="3일을 모두 채웠어요!"
      onBack={() => router.push(challengePaths.hub)}
    />
  );
}
