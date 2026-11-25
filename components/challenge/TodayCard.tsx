"use client";

import { useEffect, useRef, useState } from "react";
import { canvasToBlob } from "@/lib/challenge/card";
import { shareToInstagram, shareToKakao } from "@/lib/challenge/share";
import { InstagramButton, KakaoButton } from "./ShareButtons";
import { SHARE_LINK } from "./CardScreen";

// 오늘 저장을 마친 뒤 갓생러모임 화면에 그날 만든 스토리 카드를 바로 보여 준다(대표님 2026-11-25) — 아래에 인스타그램·카카오톡 버튼.
export default function TodayCard({ make, title, fileName, shareText }: { make: () => Promise<HTMLCanvasElement>; title: string; fileName: string; shareText: string }) {
  const [url, setUrl] = useState<string | null>(null);
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
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 그날 카드 한 번
  }, []);
  return (
    <div className="mt-4">
      <div className="mx-auto aspect-[9/16] w-[68%] overflow-hidden rounded-2xl bg-night-panel shadow-[0_10px_30px_rgba(0,0,0,.4)]">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- 이 기기에서 만든 그림(blob 주소)
          <img src={url} alt={`${title} 카드`} className="h-full w-full object-cover" />
        ) : (
          <p className="grid h-full place-items-center text-[13px] text-night-dim">카드를 만드는 중이에요…</p>
        )}
      </div>
      <div className="mt-3 grid gap-2">
        <InstagramButton onClick={() => blob.current && void shareToInstagram(blob.current, fileName)} disabled={!url} />
        <KakaoButton onClick={() => blob.current && void shareToKakao(blob.current, fileName, { title, description: shareText, url: SHARE_LINK })} disabled={!url} />
      </div>
    </div>
  );
}
