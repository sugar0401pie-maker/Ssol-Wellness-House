"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { OTHER_CODE, QUESTIONS } from "@/lib/onboarding/schema";
import { rankOf, toRankedAnswers, toggleRank } from "@/lib/onboarding/rankSelect";
import { ENGINE_KEY } from "@/lib/challenge/planView";
import { BottomBar, ChallengeShell, Loading, bigBtn } from "./ChallengeParts";
import { challengePaths } from "./useChallenge";

// 나에게 맞는 챌린지 찾기 — 질문 3개(/challenge/questions/1~3). 대표님 2026-11-26: 그냥 온 사람은 간소화한 온보딩 3개로 엔진이 사람마다 골라 줌.
// 엔진(ssol_challenge · CSO 묶음 v2.40)이 활동을 고를 때 보는 세 답: 가장 중요한 것 · 취미 · 가장 행복한 주말.
// 문항·보기 글은 온보딩과 같은 것을 그대로 쓰고(lib/onboarding/schema.ts — 임의로 다듬지 않음), 답도 같은 곳(user_onboarding)에 저장해
// 나중에 온보딩을 하면 이 답이 미리 채워져 있다. "기타(직접 입력)"는 여기서는 빼고 보여 준다(글자 수 확인 없이 짧게 끝나게).
export const CHALLENGE_QUESTION_IDS = ["values_ranked", "hobbies_ranked", "weekends_ranked"] as const;

export default function ChallengeQuestions({ step }: { step: 1 | 2 | 3 }) {
  const router = useRouter();
  const q = QUESTIONS.find((x) => x.id === CHALLENGE_QUESTION_IDS[step - 1])!;
  const options = q.options.filter(([code]) => code !== OTHER_CODE);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // 이미 답한 것이 있으면(온보딩·지난번) 채워서 보여 준다.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        const res = token ? await fetch("/api/onboarding", { headers: authHeaders(token), cache: "no-store" }) : null;
        const j = res?.ok ? ((await res.json()) as { answers?: Record<string, unknown> }) : null;
        const saved = j?.answers?.[q.id];
        const keys = Array.isArray(saved)
          ? (saved as { key?: unknown; rank?: unknown }[])
              .filter((x) => typeof x?.key === "string" && typeof x?.rank === "number" && options.some(([c]) => c === x.key))
              .sort((a, b) => (a.rank as number) - (b.rank as number))
              .map((x) => x.key as string)
          : [];
        if (!cancelled) setPicked(keys);
      } catch {
        if (!cancelled) setPicked([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id]);

  async function next() {
    if (!picked?.length) return;
    setBusy(true);
    setNotice(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error();
      const res = await fetch("/api/onboarding", { method: "PATCH", headers: authHeaders(token), body: JSON.stringify({ questionId: q.id, value: toRankedAnswers(picked) }) });
      if (!res.ok) throw new Error();
      router.push(step < 3 ? challengePaths.questions(step + 1) : challengePaths.start(ENGINE_KEY));
    } catch {
      setNotice("지금은 저장하지 못했어요. 잠시 후 다시 해 주세요.");
      setBusy(false);
    }
  }

  const maxRank = q.maxRank ?? 3;
  return (
    <ChallengeShell back={{ href: step > 1 ? challengePaths.questions(step - 1) : challengePaths.hub, label: step > 1 ? "이전 질문" : "갓생러모임" }}>
      <div className="px-5 pb-4 pt-2">
        <p className="text-[13px] text-night-amber">나에게 맞는 챌린지 찾기 · {step}/3</p>
        <h1 className="mt-1.5 break-keep text-[20px] font-bold leading-snug">{q.title}</h1>
        {q.description && <p className="mt-1 break-keep text-[13px] leading-5 text-night-sub">{q.description}</p>}
        <p className="mt-1 text-[12.5px] text-night-dim">최대 {maxRank}개까지, 누른 순서가 순위예요.</p>
        {!picked && <Loading error={null} />}
        {picked && (
          <div className="mt-3 grid gap-2">
            {options.map(([code, label]) => {
              const rank = rankOf(picked, code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setPicked((p) => toggleRank(p ?? [], code, { maxRank, exclusiveCodes: q.exclusive }))}
                  aria-pressed={!!rank}
                  className={`flex min-h-11 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[14px] ${rank ? "border-night-amber bg-night-panel text-night-text" : "border-night-border text-night-soft"}`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold ${rank ? "border-night-amber bg-night-amber text-night-on-amber" : "border-night-border text-transparent"}`}>
                    {rank ?? "○"}
                  </span>
                  <span className="break-keep">{label}</span>
                </button>
              );
            })}
          </div>
        )}
        <Link href={challengePaths.start("worry")} className="mt-4 block text-center text-[13px] text-night-sub underline underline-offset-4">
          질문 없이 세 가지 중에서 고를게요
        </Link>
        {notice && <p className="mt-3 text-center text-[13.5px] text-night-yellow" role="alert">{notice}</p>}
      </div>
      <BottomBar>
        <button type="button" onClick={() => void next()} disabled={busy || !picked?.length} className={bigBtn}>
          {busy ? "저장하는 중…" : step < 3 ? "다음" : "나에게 맞는 챌린지 보기"}
        </button>
      </BottomBar>
    </ChallengeShell>
  );
}
