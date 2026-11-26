"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CHALLENGE_THEMES, isThemeKey } from "@/lib/challenge/themes";
import { safeResultId } from "@/lib/challenge/testEntry";
import {
  ENGINE_KEY,
  ENGINE_LABEL,
  TAROT_KEY,
  nextThemeKey,
  themePlan,
  type PlanView,
} from "@/lib/challenge/planView";
import {
  BottomBar,
  ChallengeHero,
  ChallengeShell,
  Loading,
  bigBtn,
} from "./ChallengeParts";
import {
  callChallenge,
  challengePaths,
  fetchPlan,
  notifyChallengeChanged,
  useChallenge,
} from "./useChallenge";

// 챌린지 시작 화면(/challenge/start/<키>) — 마음을 바꾸면 주소도 바뀐다(대표님 2026-11-25 "화면 바꾸면 무조건 링크 나눠").
// 키: 세 가지 마음(worry · delay · energy) · me(질문 3개 답으로 엔진이 고른 챌린지, ?s=셔플 번째) · tarot(타로가 준 챌린지 그대로).
// 2026-11-26 대표님: 안 맞으면 셔플 — 세 가지 마음은 순서대로 다음 마음, me는 엔진이 다른 활동으로 다시 고름. 타로 챌린지는 그대로(위 세 가지로 바꿀 수는 있음).
// 테스트 결과 화면에서 오면 주소 끝에 ?from=test가 붙어 한 줄로 알려 준다. 이미 시작한 챌린지가 있으면 첫 화면으로 돌려보낸다.
export default function ChallengeStart({ theme }: { theme: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { data, error } = useChallenge();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fromTest = params.get("from") === "test";
  const shuffle = Math.max(0, Number(params.get("s") ?? 0) || 0);
  const result = safeResultId(params.get("result")); // 쏠 타로가 보낸 결과번호(2026-11-26)
  const isTheme = isThemeKey(theme);
  const remoteKey = `${theme}:${shuffle}:${result ?? ""}`;
  const [remote, setRemote] = useState<{
    key: string;
    plan: PlanView | null;
    hasAnswers?: boolean;
  } | null>(null);
  const plan: PlanView | null = isTheme
    ? themePlan(theme)
    : remote?.key === remoteKey
      ? remote.plan
      : null;
  const loadingPlan = !isTheme && remote?.key !== remoteKey;
  const v = data?.view;

  useEffect(() => {
    if (v && v.kind !== "pre") router.replace(challengePaths.hub);
  }, [v, router]);

  // 엔진·타로 계획은 서버에서 받아 온다(질문 3개 답이 없으면 질문으로, 타로 계획이 없으면 첫 화면으로).
  useEffect(() => {
    if (isTheme) return;
    let cancelled = false;
    fetchPlan(theme === TAROT_KEY ? "tarot" : "me", shuffle, result)
      .then((r) => {
        if (cancelled) return;
        if (theme === ENGINE_KEY && r.hasAnswers === false)
          return router.replace(challengePaths.questions(1));
        if (theme === TAROT_KEY && !r.plan)
          return router.replace(challengePaths.hub);
        setRemote({ key: remoteKey, plan: r.plan, hasAnswers: r.hasAnswers });
      })
      .catch(() => {
        if (!cancelled) setRemote({ key: remoteKey, plan: null });
      });
    return () => {
      cancelled = true;
    };
  }, [isTheme, theme, shuffle, result, remoteKey, router]);

  async function start() {
    setBusy(true);
    setNotice(null);
    try {
      const d = await callChallenge({ op: "start", theme, shuffle, result });
      if (!d.ok) throw new Error(d.message ?? "error");
      // 화면 상태(setData)는 바꾸지 않는다 — 바꾸면 "이미 시작함 → 첫 화면" 이동이 인증 화면 이동보다 먼저 일어난다.
      notifyChallengeChanged();
      router.push(
        d.view.kind === "todo"
          ? challengePaths.day(d.view.n)
          : challengePaths.hub,
      );
    } catch (e) {
      const m = (e as Error).message;
      setNotice(
        m && m !== "error"
          ? m
          : "지금은 저장하지 못했어요. 잠시 후 다시 해 주세요.",
      );
      setBusy(false);
    }
  }

  // 셔플(대표님 2026-11-26 "셔플 버튼을 바로 옆에다가 작게"): 세 가지 마음은 다음 마음으로, 엔진 챌린지는 셔플 번째를 하나 올려 다시 고름,
  // 타로 챌린지는 질문 3개 답이 있으면 엔진 챌린지로 · 없으면 세 가지 마음으로.
  const shuffleHref = isTheme
    ? challengePaths.start(nextThemeKey(theme))
    : theme === ENGINE_KEY
      ? `${challengePaths.start(ENGINE_KEY)}?s=${shuffle + 1}`
      : remote?.hasAnswers
        ? challengePaths.start(ENGINE_KEY)
        : challengePaths.start(CHALLENGE_THEMES[0].key);
  const shuffleBtn = (
    <Link
      href={shuffleHref}
      replace
      aria-label="다른 챌린지로 셔플"
      className="flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-night-border px-2.5 text-[12px] text-night-soft"
    >
      <span aria-hidden="true">↻</span> 셔플
    </Link>
  );

  return (
    // 테스트·질문 3개로 받은 챌린지는 갓생러모임 첫 화면이 이 화면으로 바로 보내므로 뒤로 가기 대신 아래 "세 가지 중에서 고를게요"
    <ChallengeShell
      back={
        isTheme ? { href: challengePaths.hub, label: "갓생러모임" } : undefined
      }
    >
      <div className="relative px-5 pb-4 pt-2 text-center">
        <ChallengeHero />
        {!v && <Loading error={error} />}
        {v?.kind === "pre" && (
          <>
            <p className="mx-1 mt-3 whitespace-pre-line break-keep text-[13.5px] leading-[1.55] text-night-sub">
              {v.msg}
            </p>
            <div className="mt-4 text-left">
              {fromTest && (
                <p className="mb-2 rounded-xl bg-night-panel px-3 py-2 text-[13px] text-night-yellow">
                  테스트 결과에 맞춘 챌린지를 골라 두었어요. 바꿔도 괜찮아요.
                </p>
              )}
              {isTheme && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] text-night-sub">
                      요즘 나에게 제일 필요한 것
                    </p>
                    {shuffleBtn}
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {CHALLENGE_THEMES.map((th) => (
                      <Link
                        key={th.key}
                        href={challengePaths.start(th.key)}
                        replace
                        aria-current={theme === th.key ? "page" : undefined}
                        className={`flex min-h-10 items-center justify-center whitespace-nowrap rounded-full border px-2 text-[13.5px] ${theme === th.key ? "border-night-amber bg-night-amber text-night-on-amber" : "border-night-border text-night-text"}`}
                      >
                        {th.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}

              {!isTheme && (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] text-night-amber">
                    {theme === TAROT_KEY
                      ? "테스트에서 받은 챌린지"
                      : plan && plan.label !== ENGINE_LABEL
                        ? `${ENGINE_LABEL} · ${plan.label}`
                        : ENGINE_LABEL}
                  </p>
                  {!loadingPlan && shuffleBtn}
                </div>
              )}
              {loadingPlan && <Loading error={null} />}
              {!loadingPlan && !plan && (
                <p className="mt-3 rounded-xl bg-night-panel px-3 py-2.5 text-[13.5px] text-night-soft">
                  지금은 나에게 맞는 챌린지를 만들지 못했어요. 아래 「세 가지
                  중에서 고를게요」로 골라 주세요.
                </p>
              )}
              {plan && (
                <div className="mt-3 grid gap-2">
                  {plan.days.map((d, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-night-panel px-3 py-2.5 text-[13.5px] leading-snug text-night-soft"
                    >
                      <b className="mr-2 font-normal text-night-amber">
                        {i + 1}일차
                      </b>
                      {d.action}
                      {d.proof && (
                        <span className="mt-0.5 block text-[12.5px] text-night-sub">
                          {d.proof}
                        </span>
                      )}
                    </div>
                  ))}
                  {/* 대표님 2026-11-25: 이름표(1주일·1달)와 글을 이름표 칸·글 칸으로 나눔 */}
                  {(plan.week || plan.month) && (
                    <div className="rounded-xl bg-night-panel px-3 py-2.5 text-[12.5px] leading-5 text-night-sub">
                      <p className="text-night-soft">3일 해 보고 마음에 들면</p>
                      <dl className="mt-1.5 grid grid-cols-[3.2em_minmax(0,1fr)] gap-x-2 gap-y-1">
                        {plan.week && (
                          <>
                            <dt className="text-night-amber">1주일</dt>
                            <dd className="break-keep">{plan.week}</dd>
                          </>
                        )}
                        {plan.month && (
                          <>
                            <dt className="text-night-amber">1달</dt>
                            <dd className="break-keep">{plan.month}</dd>
                          </>
                        )}
                      </dl>
                    </div>
                  )}
                </div>
              )}
            </div>
            {!isTheme && (
              <Link
                href={challengePaths.start(CHALLENGE_THEMES[0].key)}
                className="mt-4 block text-[13px] text-night-sub underline underline-offset-4"
              >
                세 가지 중에서 고를게요
              </Link>
            )}
            <Link
              href={challengePaths.history}
              className="mt-3 block text-[13px] text-night-dim underline underline-offset-4"
            >
              그동안의 갓생 챌린지 기록
            </Link>
            {notice && (
              <p className="mt-3 text-[13.5px] text-night-yellow" role="alert">
                {notice}
              </p>
            )}
          </>
        )}
      </div>
      {v?.kind === "pre" && plan && (
        <BottomBar>
          <button
            type="button"
            onClick={() => void start()}
            disabled={busy}
            className={bigBtn}
          >
            {busy ? "시작하는 중…" : v.button.label}
          </button>
        </BottomBar>
      )}
    </ChallengeShell>
  );
}
