"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CHALLENGE_THEMES, proofLine, themeOf } from "@/lib/challenge/themes";
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
  notifyChallengeChanged,
  useChallenge,
} from "./useChallenge";

// 챌린지 시작 화면(/challenge/start/<마음>) — 마음을 바꾸면 주소도 바뀐다(대표님 2026-11-25 "화면 바꾸면 무조건 링크 나눠").
// 테스트 결과 화면에서 오면 주소 끝에 ?from=test가 붙어 한 줄로 알려 준다. 이미 시작한 챌린지가 있으면 첫 화면으로 돌려보낸다.
export default function ChallengeStart({ theme }: { theme: string }) {
  const router = useRouter();
  const { data, error } = useChallenge();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fromTest] = useState<boolean>(() => {
    try {
      return (
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("from") === "test"
      );
    } catch {
      return false;
    }
  });
  const t = themeOf(theme);
  const v = data?.view;

  useEffect(() => {
    if (v && v.kind !== "pre") router.replace(challengePaths.hub);
  }, [v, router]);

  async function start() {
    setBusy(true);
    setNotice(null);
    try {
      const d = await callChallenge({ op: "start", theme: t.key });
      // 화면 상태(setData)는 바꾸지 않는다 — 바꾸면 "이미 시작함 → 첫 화면" 이동이 인증 화면 이동보다 먼저 일어난다.
      notifyChallengeChanged();
      router.push(
        d.view.kind === "todo"
          ? challengePaths.day(d.view.n)
          : challengePaths.hub,
      );
    } catch {
      setNotice("지금은 저장하지 못했어요. 잠시 후 다시 해 주세요.");
      setBusy(false);
    }
  }

  return (
    <ChallengeShell back={{ href: challengePaths.hub, label: "갓생러모임" }}>
      <div className="relative px-5 pb-4 pt-2 text-center">
        <ChallengeHero small />
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
              <p className="text-[13px] text-night-sub">
                요즘 나에게 제일 필요한 것
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {CHALLENGE_THEMES.map((th) => (
                  <Link
                    key={th.key}
                    href={challengePaths.start(th.key)}
                    replace
                    aria-current={t.key === th.key ? "page" : undefined}
                    className={`flex min-h-10 items-center rounded-full border px-3 text-[13.5px] ${t.key === th.key ? "border-night-amber bg-night-amber text-night-on-amber" : "border-night-border text-night-text"}`}
                  >
                    {th.label}
                  </Link>
                ))}
              </div>
              <div className="mt-3 grid gap-2">
                {t.days.map((d, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-night-panel px-3 py-2.5 text-[13.5px] leading-snug text-night-soft"
                  >
                    <b className="mr-2 font-normal text-night-amber">
                      {i + 1}일차
                    </b>
                    {d.action}
                    <span className="mt-0.5 block text-[12.5px] text-night-sub">
                      {proofLine(t.key, i)}
                    </span>
                  </div>
                ))}
                {/* 대표님 2026-11-25: 이름표(1주일·1달)와 글을 이름표 칸·글 칸으로 나눔 */}
                <div className="rounded-xl bg-night-panel px-3 py-2.5 text-[12.5px] leading-5 text-night-sub">
                  <p className="text-night-soft">3일 해 보고 마음에 들면</p>
                  <dl className="mt-1.5 grid grid-cols-[3.2em_minmax(0,1fr)] gap-x-2 gap-y-1">
                    <dt className="text-night-amber">1주일</dt>
                    <dd className="break-keep">{t.week}</dd>
                    <dt className="text-night-amber">1달</dt>
                    <dd className="break-keep">{t.month}</dd>
                  </dl>
                </div>
              </div>
            </div>
            {notice && (
              <p className="mt-3 text-[13.5px] text-night-yellow" role="alert">
                {notice}
              </p>
            )}
          </>
        )}
      </div>
      {v?.kind === "pre" && (
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
