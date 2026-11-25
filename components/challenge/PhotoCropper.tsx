"use client";

import { useEffect, useRef } from "react";
import { clampCrop, cropRect, ZOOM_MAX, ZOOM_MIN, type Crop } from "@/lib/challenge/crop";

// 정사각형 자르기 화면(요청문 3-4장): 끌어서 위치를 맞추고, 슬라이더로 확대. 미리보기만 그리고, 카드용 출력은 부모가 같은 계산(cropRect)으로 만든다.
export default function PhotoCropper({ img, crop, onChange }: { img: HTMLImageElement; crop: Crop; onChange: (c: Crop) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const SIZE = 480;

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const r = cropRect(crop, img.naturalWidth, img.naturalHeight, SIZE);
    ctx.fillStyle = "#0b1d3a";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(img, r.x, r.y, r.dw, r.dh);
  }, [img, crop]);

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drag.current || !canvas.current) return;
    const w = canvas.current.getBoundingClientRect().width || 1;
    const next = { ...crop, ox: drag.current.ox + (e.clientX - drag.current.x) / w, oy: drag.current.oy + (e.clientY - drag.current.y) / w };
    onChange(clampCrop(next, img.naturalWidth, img.naturalHeight));
  }

  return (
    <div className="text-center">
      <canvas
        ref={canvas}
        width={SIZE}
        height={SIZE}
        aria-label="사진 자르기 미리보기. 끌어서 위치를 맞춰요"
        className="mx-auto block aspect-square w-[62%] touch-none rounded-xl"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, ox: crop.ox, oy: crop.oy };
        }}
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      />
      <label className="mt-2 flex items-center justify-center gap-2 text-[12.5px] text-[#bcd0ea]">
        확대
        <input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.05}
          value={crop.zoom}
          onChange={(e) => onChange(clampCrop({ ...crop, zoom: Number(e.target.value) }, img.naturalWidth, img.naturalHeight))}
          className="w-[40%] accent-[#f3b04c]"
        />
      </label>
      <p className="mt-1 text-[12px] text-[#9db4d3]">사진을 끌어서 위치를 맞춰요.</p>
    </div>
  );
}
