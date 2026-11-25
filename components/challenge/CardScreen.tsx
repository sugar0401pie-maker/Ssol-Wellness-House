"use client";

import { useEffect, useRef, useState } from "react";
import { canvasToBlob } from "@/lib/challenge/card";
import { downloadBlob, shareToInstagram, shareToKakao } from "@/lib/challenge/share";
import { InstagramButton, KakaoButton } from "./ShareButtons";

// 스토리 카드 화면 "갓생살기 N일차 달성!"(요청문 3-5·9-3·13-9장) → 인스타그램·카카오톡 → 결과 화면 "오늘 챌린지를 완료했어요~!!"(ResultScreen — 자기 주소 /challenge/day/N/done).
// 카드는 이 기기에서 그리고(사진은 서버에 안 올림), 저장하는 순간 한 번 자동으로 내려받는다(웹이라 소리 없는 앨범 저장은 브라우저가 막아서 다운로드로 처리).
// 공유가 끝나면(올렸는지·취소했는지와 상관없이) 결과 화면으로 간다(앱은 올렸는지 알 수 없어서 "올렸어요" 확인을 받지 않음 — v1.9.3).
// 대표님 2026-11-25: 계정은 @ssol.swhmkt 하나만, "이벤트 보기"는 그 인스타그램 계정으로, 결과 화면에도 그림.
// 하단 메뉴를 가리는 전체 화면이다(9-3장).

type SaveState = "saving" | "saved" | "failed" | "idle";
export const EVENT_ACCOUNT = "@ssol.swhmkt";
export const EVENT_URL = "https://www.instagram.com/ssol.swhmkt/";
export const SHARE_LINK = "https://app.ssolwellnesshouse.com";

export default function CardScreen({
  title,
  make,
  autoSave,
  fileName,
  shareText,
  onShared,
  onBack,
}: {
  title: string;
  make: () => Promise<HTMLCanvasElement>;
  autoSave: boolean;
  fileName: string;
  shareText: string;
  onShared?: () => void; // 방금 저장한 날만: 공유가 끝나면 결과 화면 주소(/challenge/day/N/done)로
  onBack: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>(autoSave ? "saving" : "idle");
  const [copied, setCopied] = useState(false);
  const blob = useRef<Blob | null>(null);

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
        if (autoSave) setSave(downloadBlob(b, fileName) ? "saved" : "failed");
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

  async function insta() {
    if (blob.current) await shareToInstagram(blob.current, fileName);
    onShared?.();
  }
  async function kakao() {
    if (blob.current) await shareToKakao(blob.current, fileName, { title, description: shareText, url: SHARE_LINK });
    onShared?.();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(EVENT_ACCOUNT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="ssol-sky fixed inset-0 z-[60] overflow-y-auto text-night-text">
      <div className="mx-auto max-w-md px-5 pb-10 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[21px] font-bold">{title}</h2>
          <button type="button" onClick={onBack} aria-label="닫기" className="grid h-11 w-11 place-items-center rounded-full text-[22px] text-night-soft">
            ×
          </button>
        </div>
        <p className="mt-1 text-[13px] text-night-sub" aria-live="polite">
          {save === "saving" && "앨범에 저장하는 중이에요…"}
          {save === "saved" && "앨범에 저장했어요! 스토리에 올려 볼까요?"}
          {save === "failed" && "저장은 하지 않았어요. 아래 버튼으로 다시 저장할 수 있어요."}
        </p>
        <div className="mx-auto mt-4 aspect-[9/16] w-[78%] overflow-hidden rounded-2xl bg-night-panel shadow-[0_10px_30px_rgba(0,0,0,.4)]">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- 이 기기에서 만든 그림(blob 주소)이라 next/image를 쓸 수 없다
            <img src={url} alt={`${title} 카드`} className="h-full w-full object-cover" />
          ) : (
            <p className="grid h-full place-items-center text-[13px] text-night-dim">카드를 만드는 중이에요…</p>
          )}
        </div>
        <div className="mt-5 grid gap-2">
          <InstagramButton onClick={() => void insta()} disabled={!url} />
          <KakaoButton onClick={() => void kakao()} disabled={!url} />
          <button
            type="button"
            disabled={!url}
            onClick={() => blob.current && setSave(downloadBlob(blob.current, fileName) ? "saved" : "failed")}
            className="rounded-full border border-night-border py-2.5 text-[14.5px] disabled:opacity-50"
          >
            이미지 다시 저장
          </button>
        </div>
        <p className="mt-3 flex items-center justify-center gap-2 text-center text-[13px] text-night-soft">
          계정을 태그해서 올리면 추첨 대상이 돼요.
          <a href={EVENT_URL} target="_blank" rel="noopener noreferrer" className="rounded-full border border-night-border px-2.5 py-1 text-[12px] text-night-yellow">
            이벤트 보기
          </a>
        </p>
        <div className="mt-3 rounded-2xl bg-night-panel p-4">
          <p className="text-[14px]">스토리에 @멘션 스티커로 이 계정을 붙여 주세요</p>
          <div className="mt-2 flex items-center justify-between rounded-xl bg-[rgba(255,255,255,.06)] px-3 py-2">
            <span className="text-[15px]">{EVENT_ACCOUNT}</span>
            <button type="button" onClick={() => void copy()} className="min-h-9 rounded-full border border-night-border px-3 text-[12.5px]" aria-label={`${EVENT_ACCOUNT} 복사`}>
              {copied ? "복사했어요" : "복사"}
            </button>
          </div>
          <p className="mt-2 text-[12px] leading-5 text-night-dim">공개 계정으로 올려야 추첨 대상이에요. 비공개 계정은 스토리가 보이지 않아요.</p>
        </div>
        <button type="button" onClick={onBack} className="mt-4 w-full rounded-full border border-night-border py-2.5 text-[14.5px]">
          돌아가기
        </button>
      </div>
    </div>
  );
}
