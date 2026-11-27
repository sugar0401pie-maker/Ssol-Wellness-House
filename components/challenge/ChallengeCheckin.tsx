"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { planOf } from "@/lib/challenge/planView";
import { MEMO_MAX, type Method } from "@/lib/challenge/state";
import { CROP_DEFAULT, cropRect, type Crop } from "@/lib/challenge/crop";
import { savePhoto } from "@/lib/challenge/photos";
import PhotoCropper from "./PhotoCropper";
import StampSlam from "./StampSlam";
import {
  BottomBar,
  ChallengeShell,
  Loading,
  Stamps,
  bigBtn,
} from "./ChallengeParts";
import {
  callChallenge,
  challengePaths,
  markFreshCard,
  notifyChallengeChanged,
  useChallenge,
} from "./useChallenge";

// 인증하는 화면(/challenge/day/N) — 대표님 2026-11-25 "인증하려고 들어가는 화면도 별도로 구성해야지".
// 오늘의 행동 · 사진(있으면) · 한 줄 메모(꼭) → 저장하기 → 도장 쾅 → 그날 카드 화면(/challenge/day/N/card)으로.
// 오늘 할 차례가 N일차가 아니면(이미 했거나 아직 시작 전) 맞는 화면으로 옮긴다.
export default function ChallengeCheckin({ n }: { n: number }) {
  const router = useRouter();
  const { data, setData, error } = useChallenge();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>(CROP_DEFAULT);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [slam, setSlam] = useState<number | null>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const v = data?.view;
  const c = data?.current ?? null;

  useEffect(() => {
    if (!v || slam != null) return;
    if (v.kind === "todo" && v.n !== n) router.replace(challengePaths.day(v.n));
    else if (v.kind !== "todo") router.replace(challengePaths.hub);
  }, [v, n, router, slam]);

  function pickFile(f: File | undefined) {
    if (!f) return;
    const u = URL.createObjectURL(f);
    const im = new window.Image();
    im.onload = () => {
      setImg(im);
      setCrop(CROP_DEFAULT);
    };
    im.onerror = () =>
      setNotice("사진을 열지 못했어요. 다른 사진을 골라 주세요.");
    im.src = u;
  }

  function croppedCanvas(): HTMLCanvasElement | null {
    if (!img) return null;
    const cv = document.createElement("canvas");
    cv.width = 720;
    cv.height = 720;
    const ctx = cv.getContext("2d");
    if (!ctx) return null;
    const r = cropRect(crop, img.naturalWidth, img.naturalHeight, 720);
    ctx.drawImage(img, r.x, r.y, r.dw, r.dh);
    return cv;
  }

  async function checkin() {
    if (!c || !memo.trim()) return;
    const cid = c.id;
    // 대표님 2026-11-25: 메모는 꼭, 사진은 있으면 같이 저장(없으면 카드에 바다 친구 그림)
    const photo = img ? croppedCanvas() : null;
    const method: Method = photo ? "photo" : "memo";
    setBusy(true);
    setNotice(null);
    try {
      const d = await callChallenge({ op: "checkin", method, memo });
      if (!d.ok || !d.n) {
        setData(d);
        setNotice(d.message ?? null);
        setBusy(false);
        return;
      }
      if (photo) savePhoto(cid, d.n, photo); // 사진은 이 기기에만
      notifyChallengeChanged();
      markFreshCard(cid, d.n);
      setSlam(d.n);
    } catch {
      setNotice("지금은 저장하지 못했어요. 잠시 후 다시 해 주세요.");
      setBusy(false);
    }
  }

  const day =
    v?.kind === "todo" && v.dayIndex != null ? planOf(c).days[v.dayIndex] : null; // 시작할 때 남긴 계획(엔진·타로) 또는 세 가지 마음
  const canSave = v?.kind === "todo" && !busy && memo.trim().length > 0;

  return (
    <ChallengeShell back={{ href: challengePaths.hub, label: "갓생러모임" }}>
      <div className="relative px-5 pb-4 pt-1 text-center">
        {!v && <Loading error={error} />}
        {v?.kind === "todo" && day && (
          <>
            <h1 className="text-[24px] font-bold leading-snug">
              오늘은 {v.n}일차
            </h1>
            <Stamps c={c} stamped={v.stamped} dim={false} />
            <div className="mt-4 rounded-2xl bg-night-panel p-4 text-left">
              {/* CSO v2.41: 엔진 3일차 새 과제는 앞에 한 줄 질문(「어제 해 본 ○○, 어땠어요?」)을 붙여 돌아보기를 대신한다 */}
              {day.ask && <p className="mb-3 text-[15px] leading-snug text-night-soft">{day.ask}</p>}
              <p className="text-[16px] text-night-amber">오늘의 행동</p>
              <p className="mt-1 text-[18px] leading-snug">{day.action}</p>
              {day.proof && (
                <p className="mt-1 text-[13px] text-night-sub">{day.proof}</p>
              )}

              <div className="mt-4">
                {img ? (
                  <>
                    <PhotoCropper img={img} crop={crop} onChange={setCrop} />
                    <div className="mt-1.5 flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileIn.current?.click()}
                        className="min-h-9 rounded-full border border-night-border px-3 text-[12.5px] text-night-soft"
                      >
                        사진 바꾸기
                      </button>
                      <button
                        type="button"
                        onClick={() => setImg(null)}
                        className="min-h-9 rounded-full border border-night-border px-3 text-[12.5px] text-night-soft"
                      >
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
                    <svg
                      viewBox="0 0 24 24"
                      className="h-9 w-9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      aria-hidden="true"
                    >
                      <path d="M4 8h3l1.6-2.4h6.8L17 8h3v11H4z" />
                      <circle cx="12" cy="13.2" r="3.4" />
                    </svg>
                    사진 찍기
                    <small className="text-[12px] text-night-dim">
                      있으면 넣어요 · 없어도 괜찮아요
                    </small>
                  </button>
                )}
                {!img && (
                  <p className="mt-2 text-center text-[12px] text-night-dim">
                    사진이 없으면 카드에 바다 친구 그림이 들어가요. 사진은 이
                    기기에서만 써요.
                  </p>
                )}
                <input
                  ref={fileIn}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => pickFile(e.target.files?.[0] ?? undefined)}
                />
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
            {notice && (
              <p className="mt-3 text-[13.5px] text-night-yellow" role="alert">
                {notice}
              </p>
            )}
          </>
        )}
      </div>
      {v?.kind === "todo" && (
        <BottomBar>
          <button
            type="button"
            onClick={() => void checkin()}
            disabled={!canSave}
            className={bigBtn}
          >
            {busy ? "저장하는 중…" : v.button.label}
          </button>
        </BottomBar>
      )}
      {slam != null && (
        <StampSlam
          n={slam}
          onDone={() => router.replace(challengePaths.card(slam))}
        />
      )}
    </ChallengeShell>
  );
}
