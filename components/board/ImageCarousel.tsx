"use client";

import { useRef, useState } from "react";
import Image from "next/image";

// 고민우체국 글 위 그림 넘겨 보기(대표님 2026-11-25: "위에 캐러셀 넘겨서 보는 형태, 밑에 글") — 표지 + 실제 대화 캡처.
// 손가락으로 옆으로 밀거나 ‹ › 버튼·점으로 넘긴다(스크롤 스냅). 키보드: 버튼에 Tab, 그림 영역에서 ←/→.
export default function ImageCarousel({ images, label }: { images: { src: string; alt: string }[]; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const go = (k: number) => {
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(images.length - 1, k));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };
  return (
    <section aria-roledescription="carousel" aria-label={label} className="relative mt-2">
      <div
        ref={track}
        tabIndex={0}
        onScroll={(ev) => {
          const el = ev.currentTarget;
          setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        onKeyDown={(ev) => {
          if (ev.key === "ArrowRight") go(i + 1);
          if (ev.key === "ArrowLeft") go(i - 1);
        }}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl bg-night-panel outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((im, k) => (
          <div key={im.src} className="flex w-full flex-none snap-center items-center justify-center" aria-roledescription="slide" aria-label={`${k + 1} / ${images.length}`}>
            <Image src={im.src} alt={im.alt} width={900} height={1200} unoptimized loading={k === 0 ? "eager" : "lazy"} className="h-auto max-h-[70dvh] w-auto max-w-full object-contain" />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <>
          <button type="button" onClick={() => go(i - 1)} disabled={i === 0} aria-label="이전 그림" className="absolute left-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-[rgba(8,20,42,.6)] text-[22px] text-night-text disabled:opacity-30">
            ‹
          </button>
          <button type="button" onClick={() => go(i + 1)} disabled={i === images.length - 1} aria-label="다음 그림" className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-[rgba(8,20,42,.6)] text-[22px] text-night-text disabled:opacity-30">
            ›
          </button>
          <div className="mt-2 flex items-center justify-center gap-1.5">
            {images.map((im, k) => (
              <button key={im.src} type="button" onClick={() => go(k)} aria-label={`${k + 1}번째 그림`} aria-current={k === i} className={`h-2 rounded-full transition-all ${k === i ? "w-5 bg-night-amber" : "w-2 bg-night-border"}`} />
            ))}
            <span className="ml-2 text-[11.5px] text-night-dim">
              {i + 1} / {images.length}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
