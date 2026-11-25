"use client";

import { themeOf } from "@/lib/challenge/themes";
import { shortDate } from "@/lib/challenge/state";
import { ChallengeShell, HistoryRows, Loading } from "./ChallengeParts";
import { challengePaths, useChallenge } from "./useChallenge";

// 그동안의 갓생 챌린지 기록(/challenge/history) — 예전엔 첫 화면 아래 접힘이었는데 자기 주소로 나눔(대표님 2026-11-25).
export default function ChallengeHistory() {
  const { data, error } = useChallenge();
  const c = data?.current ?? null;
  return (
    <ChallengeShell back={{ href: challengePaths.hub, label: "갓생러모임" }}>
      <div className="relative px-5 pb-10 pt-1 text-left">
        <h1 className="text-[21px] font-bold">그동안의 갓생 챌린지 기록</h1>
        {!data && <Loading error={error} />}
        {data &&
          ((c?.checkins.length ?? 0) === 0 && data.history.length === 0 ? (
            <p className="mt-3 text-[13.5px] text-night-sub">
              아직 기록이 없어요. 오늘 1일차를 찍어 볼까요?
            </p>
          ) : (
            <>
              {c && c.checkins.length > 0 && (
                <>
                  <p className="mb-1.5 mt-4 text-[12.5px] text-night-amber">
                    이번 챌린지
                  </p>
                  <HistoryRows c={c} />
                </>
              )}
              {data.history.map((h) => (
                <div key={h.id}>
                  <p className="mb-1.5 mt-4 text-[12.5px] text-night-amber">
                    지난 챌린지 · {themeOf(h.theme).label} (
                    {shortDate(h.checkins[0]?.day ?? h.startedDay)} ~{" "}
                    {shortDate(
                      h.endedDay ??
                        h.checkins[h.checkins.length - 1]?.day ??
                        h.startedDay,
                    )}
                    )
                  </p>
                  <HistoryRows c={h} />
                </div>
              ))}
            </>
          ))}
      </div>
    </ChallengeShell>
  );
}
