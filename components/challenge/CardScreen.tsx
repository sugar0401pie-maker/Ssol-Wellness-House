"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { canvasToBlob, CARD_ACCOUNTS } from "@/lib/challenge/card";
import { resultLine } from "@/lib/challenge/state";

// 스토리 카드 화면 "갓생살기 N일차 달성!"(요청문 3-5·9-3·13-9장) → "인스타 스토리에 올리기" → 결과 화면 "오늘 챌린지를 완료했어요~!!".
// 카드는 이 기기에서 그리고(사진은 서버에 안 올림), 저장하는 순간 한 번 자동으로 내려받는다(웹이라 소리 없는 앨범 저장은 브라우저가 막아서 다운로드로 처리).
// 공유 창은 이미지를 넘기고, 올렸는지·취소했는지와 상관없이 닫히면 결과 화면으로 간다(앱은 올렸는지 알 수 없어서 "올렸어요" 확인을 받지 않음 — v1.9.3).
// 하단 메뉴를 가리는 전체 화면이다(9-3장).

type SaveState = "saving" | "saved" | "failed" | "idle";
const ACCOUNTS = ["@ssol.swhmkt", "@ssol.wellness"];

export default function CardScreen({
  title,
  n,
  make,
  autoSave,
  withResult,
  fileName,
  onBack,
}: {
  title: string;
  n: number;
  make: () => Promise<HTMLCanvasElement>;
  autoSave: boolean;
  withResult: boolean;
  fileName: string;
  onBack: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>(autoSave ? "saving" : "idle");
  const [result, setResult] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const blob = useRef<Blob | null>(null);

  function download(b: Blob): boolean {
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = fileName;
      if (!("download" in a)) return false;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      return true;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    let cancelled = false;
    let made: string | null = null;
    make()
      .then(canvasToBlob)
      .then((b) => {
        if (cancelled) return;
        blob.current = b;
        made = URL.createObjectURL(b);
        setUrl(made);
        if (autoSave) setSave(download(b) ? "saved" : "failed");
      })
      .catch(() => {
        if (!cancelled) setSave("failed");
      });
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 화면을 열 때 한 번 그린다
  }, []);

  async function share() {
    const b = blob.current;
    try {
      const file = b ? new File([b], fileName, { type: "image/png" }) : null;
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
    } catch {
      /* 취소해도 같은 결과 화면 */
    }
    if (withResult) setResult(true);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-[linear-gradient(180deg,#0b1d3a,#13325e)] text-[#fdf6e9]">
        <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 px-8 py-10 text-center">
          <div className="grid h-24 w-24 place-items-center rounded-full bg-[#f3b04c]" style={{ animation: "ssol-stamp-pop .45s ease-out both" }} aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-12 w-12">
              <path d="M5.5 12.5 L10 17 L18.5 7.5" fill="none" stroke="#3b2208" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-[23px] font-bold leading-snug">오늘 챌린지를 완료했어요~!!</h2>
          <p className="text-[16px] text-[#ffd36b]">{resultLine(n)}</p>
          <p className="break-keep text-[12.5px] leading-5 text-[#9db4d3]">스토리에 두 공식 계정을 태그하고 공개 계정으로 올리면 추첨 대상이에요. 올렸는지는 운영에서 확인해요.</p>
          <div className="mt-2 grid w-full gap-2">
            <button type="button" onClick={onBack} className="rounded-full bg-[#f3b04c] py-3 text-[16px] font-bold text-[#3b2208]">
              갓생러모임으로
            </button>
            <Link href="/home" className="rounded-full border border-[#5b79a6] py-3 text-[15px]">
              홈으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[linear-gradient(180deg,#0b1d3a,#13325e)] text-[#fdf6e9]">
      <div className="mx-auto max-w-md px-5 pb-10 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[21px] font-bold">{title}</h2>
          <button type="button" onClick={onBack} aria-label="닫기" className="grid h-11 w-11 place-items-center rounded-full text-[22px] text-[#cfe0f5]">
            ×
          </button>
        </div>
        <p className="mt-1 text-[13px] text-[#bcd0ea]" aria-live="polite">
          {save === "saving" && "앨범에 저장하는 중이에요…"}
          {save === "saved" && "앨범에 저장했어요! 스토리에 올려 볼까요?"}
          {save === "failed" && "저장은 하지 않았어요. 아래 버튼으로 다시 저장할 수 있어요."}
        </p>
        <div className="mx-auto mt-4 aspect-[9/16] w-[78%] overflow-hidden rounded-2xl bg-[#13325e] shadow-[0_10px_30px_rgba(0,0,0,.4)]">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- 이 기기에서 만든 그림(blob 주소)이라 next/image를 쓸 수 없다
            <img src={url} alt={`${title} 카드`} className="h-full w-full object-cover" />
          ) : (
            <p className="grid h-full place-items-center text-[13px] text-[#9db4d3]">카드를 만드는 중이에요…</p>
          )}
        </div>
        <div className="mt-5 grid gap-2">
          <button type="button" onClick={share} disabled={!url} className="rounded-full bg-[#f3b04c] py-3 text-[16px] font-bold text-[#3b2208] disabled:opacity-50">
            인스타 스토리에 올리기
          </button>
          <button
            type="button"
            disabled={!url}
            onClick={() => blob.current && setSave(download(blob.current) ? "saved" : "failed")}
            className="rounded-full border border-[#5b79a6] py-2.5 text-[14.5px] disabled:opacity-50"
          >
            이미지 다시 저장
          </button>
        </div>
        <p className="mt-3 text-center text-[13px] text-[#cfe0f5]">두 계정을 태그해서 올리면 추첨 대상이 돼요.</p>
        <div className="mt-3 rounded-2xl bg-[rgba(8,20,42,.6)] p-4">
          <p className="text-[14px]">스토리에 @멘션 스티커로 두 계정을 붙여 주세요</p>
          <div className="mt-2 grid gap-2">
            {ACCOUNTS.map((acc) => (
              <div key={acc} className="flex items-center justify-between rounded-xl bg-[rgba(255,255,255,.06)] px-3 py-2">
                <span className="text-[15px]">{acc}</span>
                <button type="button" onClick={() => void copy(acc)} className="min-h-9 rounded-full border border-[#5b79a6] px-3 text-[12.5px]" aria-label={`${acc} 복사`}>
                  {copied === acc ? "복사했어요" : "복사"}
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[12px] leading-5 text-[#9db4d3]">공개 계정으로 올려야 추첨 대상이에요. 비공개 계정은 스토리가 보이지 않아요.</p>
        </div>
        <button type="button" onClick={onBack} className="mt-4 w-full rounded-full border border-[#5b79a6] py-2.5 text-[14.5px]">
          돌아가기
        </button>
        <p className="sr-only">카드 맨 아래에 {CARD_ACCOUNTS}가 작게 들어가요.</p>
      </div>
    </div>
  );
}
