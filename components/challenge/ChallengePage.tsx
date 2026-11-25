"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CHALLENGE_THEMES,
  isThemeKey,
  proofLine,
  themeOf,
} from "@/lib/challenge/themes";
import { dayDiff, shortDate } from "@/lib/challenge/state";
import TodayCard from "./TodayCard";
import {
  BottomBar,
  ChallengeHero,
  ChallengeShell,
  Loading,
  Stamps,
  bigBtn,
} from "./ChallengeParts";
import {
  callChallenge,
  challengePaths,
  dayCardMaker,
  notifyChallengeChanged,
  useChallenge,
} from "./useChallenge";

// 갓생러모임 첫 화면(/challenge) — 쏠 작심삼일 챌린지(요청문 v1.9.4 3·9·13장).
// 대표님 2026-11-25 "단계마다 나누게 / 화면 바꾸면 무조건 링크 나눠": 여기는 지금 상태(도장·오늘 몇 일차)만 보여 주고,
// 각 단계는 자기 주소로 간다 — 시작(/challenge/start/<마음>) · 인증(/challenge/day/N) · 카드(…/card) · 결과(…/done) · 완료 카드(/challenge/complete) · 기록(/challenge/history).
// 날짜·일차 판단은 서버(/api/challenge)가 한다. 사진은 이 기기에서만(서버에 안 올림).

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const dateWithDay = (d: string) =>
  `${shortDate(d)}(${WEEK[new Date(`${d}T00:00:00Z`).getUTCDay()]})`;

export { notifyChallengeChanged };

export default function ChallengePage() {
  const router = useRouter();
  const { data, setData, error } = useChallenge();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // 예전 주소(/challenge?theme=…, 테스트 결과 화면에서 옴)는 그 마음의 시작 화면으로 옮긴다.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("theme");
      if (isThemeKey(q)) router.replace(`${challengePaths.start(q)}?from=test`);
    } catch {
      /* 무시 */
    }
  }, [router]);

  async function restart() {
    const prev = data?.current?.theme;
    setBusy(true);
    setNotice(null);
    try {
      const d = await callChallenge({ op: "restart" });
      setData(d);
      notifyChallengeChanged();
      if (d.view.kind === "pre")
        router.push(
          challengePaths.start(
            isThemeKey(prev) ? prev : CHALLENGE_THEMES[0].key,
          ),
        );
    } catch {
      setNotice("지금은 저장하지 못했어요. 잠시 후 다시 해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const v = data?.view;
  const c = data?.current ?? null;
  const t = themeOf(c?.theme);
  const day = v?.dayIndex != null ? t.days[v.dayIndex] : null;
  const lastCk = c?.checkins[c.checkins.length - 1];

  return (
    <ChallengeShell>
      <div className="relative px-5 pb-4 pt-6 text-center">
        <ChallengeHero />
        {/* 대표님 2026-11-25 문구 */}
        <p className="mt-3 break-keep text-[13.5px] leading-5 text-night-sub">
          갓생러가 별 거 있나요?
          <br />
          나와의 약속 3일만 지켜도 당신은 갓생러~!
        </p>

        {!v && <Loading error={error} />}

        {v && (
          <>
            <Stamps c={c} stamped={v.stamped} dim={v.kind === "pre"} />
            {v.todayLine && (
              <p className="mt-3 text-[24px] font-bold leading-snug">
                {v.todayLine}
              </p>
            )}
            {v.msg && (
              <p
                className="mx-1 mt-2 whitespace-pre-line break-keep text-[13.5px] leading-[1.55] text-night-sub"
                aria-live="polite"
              >
                {v.msg}
              </p>
            )}

            {/* 시작 전: 마음 고르기 — 고르면 그 마음의 시작 화면(3일 계획)으로 */}
            {v.kind === "pre" && (
              <div className="mt-4 text-left">
                <p className="text-[13px] text-night-sub">
                  요즘 내 마음에 가까운 것
                </p>
                <div className="mt-1.5 grid gap-2">
                  {CHALLENGE_THEMES.map((th) => (
                    <Link
                      key={th.key}
                      href={challengePaths.start(th.key)}
                      className="flex min-h-12 items-center justify-between rounded-xl border border-night-border bg-night-panel px-4 text-[15px]"
                    >
                      {th.label}
                      <span aria-hidden="true" className="text-night-dim">
                        ›
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {v.kind === "todo" && day && (
              <div className="mt-4 rounded-2xl bg-night-panel p-4 text-left">
                <p className="text-[16px] text-night-amber">오늘의 행동</p>
                <p className="mt-1 text-[18px] leading-snug">{day.action}</p>
                <p className="mt-1 text-[13px] text-night-sub">
                  {proofLine(t.key, v.dayIndex ?? 0)}
                </p>
              </div>
            )}

            {v.kind === "doneToday" && c && lastCk && (
              <TodayCard
                key={`${c.id}:${lastCk.n}`}
                make={dayCardMaker(c.id, lastCk)}
                title={`갓생살기 ${lastCk.n}일차 달성!`}
                fileName={`ssol-challenge-day${lastCk.n}.png`}
                shareText={lastCk.memo ?? ""}
              />
            )}

            {v.kind === "complete" && c && (
              <Link
                href={challengePaths.complete}
                className="mx-auto mt-4 block w-[64%]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 바탕 그림 미리보기 */}
                <img
                  src="/challenge/card-all.webp"
                  alt="3일 모두 완료 카드 보기"
                  className="w-full rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,.4)]"
                />
                <span className="mt-2 block text-[13px] text-night-soft underline underline-offset-4">
                  완료 카드 만들기
                </span>
              </Link>
            )}

            {notice && (
              <p className="mt-3 text-[13.5px] text-night-yellow" role="alert">
                {notice}
              </p>
            )}
          </>
        )}
      </div>

      {v && v.kind !== "pre" && (
        <BottomBar>
          {v.kind === "todo" ? (
            <Link href={challengePaths.day(v.n)} className={bigBtn}>
              {v.n}일차 인증하러 가기
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => v.button.op === "restart" && void restart()}
              disabled={!v.button.enabled || busy}
              className={bigBtn}
            >
              {v.button.label}
            </button>
          )}
        </BottomBar>
      )}

      {v && (
        <div className="relative px-5 pb-10">
          {c && lastCk && v.kind !== "doneToday" && (
            <Link
              href={challengePaths.card(lastCk.n)}
              className="mt-1 block w-full rounded-full border border-night-border bg-night-panel py-2.5 text-center text-[14.5px]"
            >
              {lastCk.n}일차 카드 다시 보기
            </Link>
          )}
          {c && v.kind !== "pre" && data && (
            <p className="mt-2 text-center text-[12px] text-night-dim">
              {dateWithDay(data.today)}
              {dayDiff(data.today, c.startedDay) >= 0 &&
                ` · 시작 후 ${dayDiff(data.today, c.startedDay) + 1}일째`}
            </p>
          )}
          <Link
            href={challengePaths.history}
            className="mt-6 flex min-h-12 items-center justify-between border-t border-night-line text-[17px] font-bold"
          >
            그동안의 갓생 챌린지 기록
            <span aria-hidden="true" className="text-[14px] text-night-dim">
              ›
            </span>
          </Link>
        </div>
      )}
    </ChallengeShell>
  );
}
