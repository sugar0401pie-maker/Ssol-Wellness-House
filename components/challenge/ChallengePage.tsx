"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { gaegu } from "@/lib/fonts/gaegu";
import { CHALLENGE_THEMES, DEFAULT_THEME, isThemeKey, proofLine, themeOf } from "@/lib/challenge/themes";
import { seaArtFor } from "@/lib/challenge/seaArt";
import { notoFamily } from "@/lib/challenge/card";
import TodayCard from "./TodayCard";
import { MEMO_MAX, dayDiff, shortDate, type Challenge, type Method, type View } from "@/lib/challenge/state";
import { CROP_DEFAULT, cropRect, type Crop } from "@/lib/challenge/crop";
import { drawCompleteCard, drawDayCard } from "@/lib/challenge/card";
import { loadPhoto, loadThumb, savePhoto } from "@/lib/challenge/photos";
import PhotoCropper from "./PhotoCropper";
import StampSlam from "./StampSlam";
import CardScreen from "./CardScreen";
import SkyDecor from "@/components/app/SkyDecor";

// 갓생러모임 — 쏠 작심삼일 챌린지(요청문 v1.9.4 3·9·13장). 글자는 보통 글자(손글씨는 카드·도장 쾅에만, 13-1장).
// 위에서부터: 이름표·제목 → 1·2·3일차 도장 → "오늘은 N일차" → 안내 → (시작 전) 3일 계획 → 오늘의 행동 → 사진 네모 → 한 줄 메모 →
// 저장하기(화면 아래에 붙어 있음) → 다른 방식 안내 → 오늘 카드 다시 보기 → 그동안의 기록(접힘).
// 날짜·일차 판단은 서버(/api/challenge)가 한다. 사진은 이 기기에서만(서버에 안 올림).

type Payload = { ok: boolean; today: string; current: Challenge | null; history: Challenge[]; rewarded: boolean; view: View; message?: string; n?: number; memo?: string | null };
type Overlay =
  | { kind: "slam"; n: number; then: Overlay }
  | { kind: "card"; n: 1 | 2 | 3; cid: string; method: Method; memo: string | null; day: string; autoSave: boolean; withResult: boolean }
  | { kind: "complete"; cid: string }
  | null;

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const dateWithDay = (d: string) => `${shortDate(d)}(${WEEK[new Date(`${d}T00:00:00Z`).getUTCDay()]})`;

export function notifyChallengeChanged() {
  try {
    window.dispatchEvent(new Event("ssol:challenge"));
  } catch {
    /* 무시 */
  }
}

type TokenFn = () => Promise<string | null>;
async function call(tokenFn: TokenFn, body?: object): Promise<Payload> {
  const token = await tokenFn();
  if (!token) throw new Error("login");
  const res = await fetch("/api/challenge", body ? { method: "POST", headers: authHeaders(token), body: JSON.stringify(body) } : { headers: authHeaders(token), cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as Payload;
  if (!res.ok && !json.view) throw new Error(json.message ?? "error");
  return json;
}

function Stamps({ c, stamped, dim }: { c: Challenge | null; stamped: number; dim: boolean }) {
  return (
    <div className={`mt-3 flex justify-center gap-4 ${dim ? "opacity-55" : ""}`} aria-label={`도장 ${stamped}개`}>
      {[1, 2, 3].map((d) => {
        const on = d <= stamped;
        const ck = c?.checkins.find((x) => x.n === d);
        return (
          <div key={d} className="w-[60px] text-center text-[12.5px] text-night-sub">
            <div className={`mx-auto mb-1 grid h-[60px] w-[60px] place-items-center rounded-full text-[19px] font-bold ${on ? "bg-night-amber text-night-on-amber" : "border-2 border-dashed border-night-border text-night-dim"}`}>
              {on ? (
                <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
                  <path d="M5.5 12.5 L10 17 L18.5 7.5" fill="none" stroke="var(--night-on-amber)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                d
              )}
            </div>
            {d}일차
            {ck && <span className="block text-[11px] text-night-dim">{shortDate(ck.day)}</span>}
          </div>
        );
      })}
    </div>
  );
}

function HistoryRows({ c }: { c: Challenge }) {
  return (
    <ul className="grid gap-2">
      {c.checkins.map((ck) => {
        const thumb = loadThumb(c.id, ck.n);
        return (
          <li key={ck.n} className="flex items-center gap-3 rounded-xl bg-night-panel p-2">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element -- 이 기기에 둔 작은 사진(data 주소)
              <img src={thumb} alt={`${ck.n}일차 사진`} className="h-12 w-12 flex-none rounded-lg object-cover" />
            ) : (
              <span className="grid h-12 w-12 flex-none place-items-center rounded-lg bg-[rgba(243,176,76,.18)] text-[12px] text-night-amber">{ck.n}일</span>
            )}
            <span className="min-w-0 text-[13px] leading-5">
              <span className="text-night-amber">
                {ck.n}일차 · {shortDate(ck.day)}
              </span>
              {/* 이용자 메모는 글자 그대로(HTML로 해석하지 않음 — React가 그대로 넣는다) */}
              <span className="block truncate text-night-soft">{ck.memo || ck.action}</span>
            </span>
          </li>
        );
      })}
      {c.checkins.length >= 3 && (
        <li className="rounded-xl bg-[rgba(243,176,76,.12)] px-3 py-2 text-[13px] text-night-yellow">
          3일차 챌린지 완료 <span className="text-night-soft">/ 3일을 모두 채웠어요</span>
        </li>
      )}
    </ul>
  );
}

// getToken: 화면 확인용으로 바꿔 끼울 수 있게 둔 자리(실제 화면은 로그인 세션의 토큰).
export default function ChallengePage({ getToken = getAccessToken }: { getToken?: TokenFn } = {}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 테스트 결과 마지막 화면에서 /challenge?theme=… 로 오면 그 마음을 미리 고른다(마음 칸은 서버 응답 뒤에만 그려져 첫 그림과 어긋나지 않음).
  // 테스트에서 넘어왔는지(주소에 theme가 있었는지) — 시작 전 화면에 한 줄로 알려 준다.
  const [fromTest] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && isThemeKey(new URLSearchParams(window.location.search).get("theme"));
    } catch {
      return false;
    }
  });
  const [theme, setTheme] = useState<string>(() => {
    try {
      const q = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("theme");
      return isThemeKey(q) ? q : DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  });
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>(CROP_DEFAULT);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [histOpen, setHistOpen] = useState(false);
  const fileIn = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    call(getToken)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError("챌린지를 불러오지 못했어요. 잠시 후 다시 열어 주세요.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 열 때 한 번
  }, []);

  function pickFile(f: File | undefined) {
    if (!f) return;
    const u = URL.createObjectURL(f);
    const im = new window.Image();
    im.onload = () => {
      setImg(im);
      setCrop(CROP_DEFAULT);
    };
    im.onerror = () => setNotice("사진을 열지 못했어요. 다른 사진을 골라 주세요.");
    im.src = u;
  }

  function croppedCanvas(): HTMLCanvasElement | null {
    if (!img) return null;
    const c = document.createElement("canvas");
    c.width = 720;
    c.height = 720;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const r = cropRect(crop, img.naturalWidth, img.naturalHeight, 720);
    ctx.drawImage(img, r.x, r.y, r.dw, r.dh);
    return c;
  }

  async function act(op: "start" | "restart") {
    setBusy(true);
    setNotice(null);
    try {
      const d = await call(getToken, op === "start" ? { op, theme } : { op });
      setData(d);
      notifyChallengeChanged();
    } catch {
      setNotice("지금은 저장하지 못했어요. 잠시 후 다시 해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function checkin() {
    if (!data?.current) return;
    const cid = data.current.id;
    // 대표님 2026-11-25: 메모는 꼭, 사진은 있으면 같이 저장(없으면 카드에 바다 친구 그림)
    const photo = img ? croppedCanvas() : null;
    const method: Method = photo ? "photo" : "memo";
    if (!memo.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const d = await call(getToken, { op: "checkin", method, memo });
      if (!d.ok || !d.n) {
        setData(d);
        setNotice(d.message ?? null);
        return;
      }
      if (photo) savePhoto(cid, d.n, photo); // 사진은 이 기기에만
      setData(d);
      notifyChallengeChanged();
      const n = d.n as 1 | 2 | 3;
      setImg(null);
      setMemo("");
      setOverlay({ kind: "slam", n, then: { kind: "card", n, cid, method, memo: d.memo ?? null, day: d.today, autoSave: true, withResult: true } });
    } catch {
      setNotice("지금은 저장하지 못했어요. 잠시 후 다시 해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const v = data?.view;
  const c = data?.current ?? null;
  const t = themeOf(c?.theme ?? theme);
  const day = v?.dayIndex != null ? t.days[v.dayIndex] : null;
  const canSave = v?.kind === "todo" && !busy && memo.trim().length > 0;
  const lastCk = c?.checkins[c.checkins.length - 1];
  const family = typeof window === "undefined" ? "sans-serif" : notoFamily(); // 카드 메모는 쏘웰라 보통 글꼴(대표님 2026-11-25)
  const dayCard = (cid: string, ck: { n: number; method: Method; memo: string | null; day: string }) => () =>
    drawDayCard({ day: ck.n as 1 | 2 | 3, method: ck.method, photoUrl: ck.method === "photo" ? loadPhoto(cid, ck.n) : null, artUrl: seaArtFor(`${cid}:${ck.n}`), memo: ck.memo, dateLabel: shortDate(ck.day) }, family);

  function openCard(ck: NonNullable<typeof lastCk>, cid: string) {
    setOverlay({ kind: "card", n: ck.n as 1 | 2 | 3, cid, method: ck.method, memo: ck.memo, day: ck.day, autoSave: false, withResult: false });
  }

  return (
    <div className="relative h-full overflow-y-auto ssol-sky text-night-text">
      <SkyDecor />
      {/* 글꼴 클래스를 한 번 써 둬야 카드에 쓸 손글씨 글꼴 정의가 페이지에 실린다 */}
      <span className={`${gaegu.className} sr-only`} aria-hidden="true">
        쏠
      </span>
      <div className="relative px-5 pb-4 pt-6 text-center">
        {/* 대표님 2026-11-25: 맨 위 "갓생러모임" 이름표는 뺌(하단 메뉴에 이미 이름이 있음) */}
        {/* 대표님 2026-11-25: 제목 자리에 손글씨 그림("쏠 작심삼일 챌린지" 글자가 그림 안 — 제목은 화면 읽기용으로만) */}
        <h1 className="sr-only">쏠 작심삼일 챌린지</h1>
        <Image src="/challenge/hero.webp" alt="" aria-hidden="true" width={800} height={800} priority unoptimized className="mx-auto h-auto w-[82%] rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,.35)]" />
        {/* 대표님 2026-11-25 문구 */}
        <p className="mt-3 break-keep text-[13.5px] leading-5 text-night-sub">
          갓생러가 별 거 있나요?
          <br />
          나와의 약속 3일만 지켜도 당신은 갓생러~!
        </p>

        {error && <p className="mt-8 text-[14px] text-night-yellow">{error}</p>}
        {!data && !error && <p className="mt-8 text-[14px] text-night-dim">불러오는 중…</p>}

        {v && (
          <>
            <Stamps c={c} stamped={v.stamped} dim={v.kind === "pre"} />
            {v.todayLine && <p className="mt-3 text-[24px] font-bold leading-snug">{v.todayLine}</p>}
            {v.msg && (
              <p className="mx-1 mt-2 whitespace-pre-line break-keep text-[13.5px] leading-[1.55] text-night-sub" aria-live="polite">
                {v.msg}
              </p>
            )}

            {v.kind === "pre" && (
              <div className="mt-4 text-left">
                {fromTest && <p className="mb-2 rounded-xl bg-night-panel px-3 py-2 text-[13px] text-night-yellow">테스트 결과에 맞춘 챌린지를 골라 두었어요. 바꿔도 괜찮아요.</p>}
                <p className="text-[13px] text-night-sub">요즘 내 마음에 가까운 것</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {CHALLENGE_THEMES.map((th) => (
                    <button
                      key={th.key}
                      type="button"
                      aria-pressed={theme === th.key}
                      onClick={() => setTheme(th.key)}
                      className={`min-h-10 rounded-full border px-3 text-[13.5px] ${theme === th.key ? "border-night-amber bg-night-amber text-night-on-amber" : "border-night-border text-night-text"}`}
                    >
                      {th.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid gap-2">
                  {t.days.map((d, i) => (
                    <div key={i} className="rounded-xl bg-night-panel px-3 py-2.5 text-[13.5px] leading-snug text-night-soft">
                      <b className="mr-2 font-normal text-night-amber">{i + 1}일차</b>
                      {d.action}
                      <span className="mt-0.5 block text-[12.5px] text-night-sub">{proofLine(t.key, i)}</span>
                    </div>
                  ))}
                  {/* 대표님 2026-11-25: 이름표(1주일·1달)와 글이 한 줄에 섞여 어색하게 줄바꿈되던 것을 이름표 칸·글 칸으로 나눔 */}
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
            )}

            {v.kind === "todo" && day && (
              <div className="mt-4 rounded-2xl bg-night-panel p-4 text-left">
                <p className="text-[16px] text-night-amber">오늘의 행동</p>
                <p className="mt-1 text-[18px] leading-snug">{day.action}</p>
                <p className="mt-1 text-[13px] text-night-sub">{proofLine(t.key, v.dayIndex ?? 0)}</p>

                <div className="mt-4">
                  {img ? (
                    <>
                      <PhotoCropper img={img} crop={crop} onChange={setCrop} />
                      <div className="mt-1.5 flex justify-center gap-2">
                        <button type="button" onClick={() => fileIn.current?.click()} className="min-h-9 rounded-full border border-night-border px-3 text-[12.5px] text-night-soft">
                          사진 바꾸기
                        </button>
                        <button type="button" onClick={() => setImg(null)} className="min-h-9 rounded-full border border-night-border px-3 text-[12.5px] text-night-soft">
                          사진 빼기
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileIn.current?.click()}
                      className="mx-auto flex aspect-square w-[58%] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-night-dim text-[15px]"
                    >
                      <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <path d="M4 8h3l1.6-2.4h6.8L17 8h3v11H4z" />
                        <circle cx="12" cy="13.2" r="3.4" />
                      </svg>
                      사진 찍기
                      <small className="text-[12px] text-night-dim">있으면 넣어요 · 없어도 괜찮아요</small>
                    </button>
                  )}
                  {!img && <p className="mt-2 text-center text-[12px] text-night-dim">사진이 없으면 카드에 바다 친구 그림이 들어가요. 사진은 이 기기에서만 써요.</p>}
                  <input ref={fileIn} type="file" accept="image/*" hidden onChange={(e) => pickFile(e.target.files?.[0] ?? undefined)} />
                  <input
                    type="text"
                    value={memo}
                    maxLength={MEMO_MAX}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="오늘 한 걸 한 줄로 적어 봐요"
                    aria-label="오늘 한 걸 한 줄로(꼭 적어 주세요)"
                    aria-required="true"
                    className="mt-3 w-full rounded-xl border border-night-border bg-[rgba(255,255,255,.06)] px-3 py-2.5 font-sans text-[15px] text-night-text outline-none placeholder:text-night-dim focus:border-night-amber"
                  />
                  <p className="mt-1 flex justify-between text-[11.5px] text-night-dim">
                    <span>한 줄 메모는 꼭 적어 주세요. 카드에 들어가요.</span>
                    <span>
                      {[...memo].length} / {MEMO_MAX}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {v.kind === "doneToday" && c && lastCk && (
              <TodayCard key={`${c.id}:${lastCk.n}`} make={dayCard(c.id, lastCk)} title={`갓생살기 ${lastCk.n}일차 달성!`} fileName={`ssol-challenge-day${lastCk.n}.png`} shareText={lastCk.memo ?? ""} />
            )}

            {v.kind === "complete" && c && (
              <button type="button" onClick={() => setOverlay({ kind: "complete", cid: c.id })} className="mx-auto mt-4 block w-[64%]">
                {/* eslint-disable-next-line @next/next/no-img-element -- 바탕 그림 미리보기 */}
                <img src="/challenge/card-all.webp" alt="3일 모두 완료 카드 보기" className="w-full rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,.4)]" />
                <span className="mt-2 block text-[13px] text-night-soft underline underline-offset-4">완료 카드 만들기</span>
              </button>
            )}

            {notice && (
              <p className="mt-3 text-[13.5px] text-night-yellow" role="alert">
                {notice}
              </p>
            )}
          </>
        )}
      </div>

      {v && (
        <div className="sticky bottom-0 z-10 bg-[linear-gradient(to_top,rgba(13,36,70,.98)_70%,rgba(13,36,70,0))] px-5 pb-3 pt-4">
          {v.button.op === "checkin" ? (
            <button type="button" onClick={checkin} disabled={!canSave} className="w-full rounded-full bg-night-amber py-3 text-[17px] font-bold text-night-on-amber disabled:bg-night-disabled disabled:text-night-disabled-text">
              {busy ? "저장하는 중…" : v.button.label}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => v.button.op && void act(v.button.op as "start" | "restart")}
              disabled={!v.button.enabled || busy}
              className="w-full rounded-full bg-night-amber py-3 text-[17px] font-bold text-night-on-amber disabled:bg-night-disabled disabled:text-night-disabled-text"
            >
              {v.button.label}
            </button>
          )}
        </div>
      )}

      {v && (
        <div className="relative px-5 pb-10">
          {c && lastCk && v.kind !== "doneToday" && (
            <button type="button" onClick={() => openCard(lastCk, c.id)} className="mt-1 w-full rounded-full border border-night-border bg-night-panel py-2.5 text-[14.5px]">
              오늘 카드 다시 보기
            </button>
          )}
          {c && v.kind !== "pre" && data && (
            <p className="mt-2 text-center text-[12px] text-night-dim">
              {dateWithDay(data.today)}
              {dayDiff(data.today, c.startedDay) >= 0 && ` · 시작 후 ${dayDiff(data.today, c.startedDay) + 1}일째`}
            </p>
          )}

          <section className="mt-6 border-t border-night-line text-left">
            <button
              type="button"
              aria-expanded={histOpen}
              aria-controls="chal-history"
              onClick={() => setHistOpen((o) => !o)}
              className="flex min-h-12 w-full items-center justify-between text-[17px] font-bold"
            >
              그동안의 갓생 챌린지 기록
              <span aria-hidden="true" className="text-[14px] text-night-dim">
                {histOpen ? "⌃" : "⌄"}
              </span>
            </button>
            <div id="chal-history" hidden={!histOpen}>
              {(c?.checkins.length ?? 0) === 0 && (data?.history.length ?? 0) === 0 ? (
                <p className="text-[13.5px] text-night-sub">아직 기록이 없어요. 오늘 1일차를 찍어 볼까요?</p>
              ) : (
                <>
                  {c && c.checkins.length > 0 && (
                    <>
                      <p className="mb-1.5 mt-1 text-[12.5px] text-night-amber">이번 챌린지</p>
                      <HistoryRows c={c} />
                    </>
                  )}
                  {data?.history.map((h) => (
                    <div key={h.id}>
                      <p className="mb-1.5 mt-4 text-[12.5px] text-night-amber">
                        지난 챌린지 · {themeOf(h.theme).label} ({shortDate(h.checkins[0]?.day ?? h.startedDay)} ~ {shortDate(h.endedDay ?? h.checkins[h.checkins.length - 1]?.day ?? h.startedDay)})
                      </p>
                      <HistoryRows c={h} />
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {overlay?.kind === "slam" && <StampSlam n={overlay.n} onDone={() => setOverlay(overlay.then)} />}
      {overlay?.kind === "card" && (
        <CardScreen
          title={`갓생살기 ${overlay.n}일차 달성!`}
          n={overlay.n}
          autoSave={overlay.autoSave}
          withResult={overlay.withResult}
          fileName={`ssol-challenge-day${overlay.n}.png`}
          make={dayCard(overlay.cid, { n: overlay.n, method: overlay.method, memo: overlay.memo, day: overlay.day })}
          shareText={overlay.memo ?? ""}
          resultArt={seaArtFor(`${overlay.cid}:${overlay.n}:result`)}
          onBack={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === "complete" && c && (
        <CardScreen
          title="와! 3일차 챌린지를 완료했어요!"
          n={3}
          autoSave={false}
          withResult={false}
          fileName="ssol-challenge-complete.png"
          make={() => drawCompleteCard(c.checkins.map((ck) => ({ n: ck.n, thumbUrl: ck.method === "photo" ? loadThumb(c.id, ck.n) : null, artUrl: seaArtFor(`${c.id}:${ck.n}`), text: ck.memo || ck.action })), family)}
          shareText="3일을 모두 채웠어요!"
          resultArt={seaArtFor(`${c.id}:complete`)}
          onBack={() => setOverlay(null)}
        />
      )}
    </div>
  );
}
