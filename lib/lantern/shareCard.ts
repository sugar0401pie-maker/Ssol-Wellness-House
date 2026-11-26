"use client";
// 풍등 공유·자동 저장 그림(대표님 2026-11-26 "공유할 때에는 사용자가 쓴 소원 화면이 가도록"): 소원을 쓰던 첫 장면 그대로 —
// 그 사람이 본 그림 묶음의 첫 장면(펭귄·비버는 풍등 그림을 1.6배 자리에 얹음) + 풍등 안에 쓴 소원. 화면과 같은 자리·같은 글자 크기 비율.
// 그림은 이 기기에서만 그린다(서버에 올리지 않음). 카카오톡으로 보낼 때만 카카오가 그림을 받아 간다(lib/challenge/share.ts).
import { ensureFont, loadImage, wrapLines } from "@/lib/challenge/card";
import { WISH_BOX, type LanternSet } from "./config";

export const LANTERN_CARD_W = 1080;
export const LANTERN_CARD_H = 2160;
const INK = "#4a2a0a"; // 화면의 소원 글자 색(LanternPage)

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

// 가운데(cx, cy)에 맞춰 여러 줄 글자를 쓴다(풍등 안 글자처럼 은은한 빛).
function wishText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxW: number, font: number, family: string) {
  ctx.font = `400 ${font}px ${family}`;
  const lines = wrapLines((t) => ctx.measureText(t).width, text, maxW, 4);
  const lh = font * 1.5;
  ctx.save();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(255,236,190,.9)";
  ctx.shadowBlur = font * 0.4;
  lines.forEach((l, i) => ctx.fillText(l, cx, cy + (i - (lines.length - 1) / 2) * lh));
  ctx.restore();
}

export async function drawWishCard(set: LanternSet, wish: string, family: string): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = LANTERN_CARD_W;
  c.height = LANTERN_CARD_H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const first = set.scenes.find((x) => x.n === 1)?.src ?? set.scenes[0].src;
  const [bg, lantern] = await Promise.all([loadImage(first), set.lantern ? loadImage(set.lantern.src) : Promise.resolve(null), ensureFont(family, wish)]);
  cover(ctx, bg, c.width, c.height);
  if (set.lantern && lantern) {
    const f = set.lantern.frames[1];
    const lw = (f.width / 100) * c.width;
    const lh = lw * 1.5;
    const lx = (f.left / 100) * c.width;
    const ly = (f.top / 100) * c.height;
    ctx.drawImage(lantern, lx, ly, lw, lh);
    const b = set.lantern.wishBox;
    const bx = lx + (b.left / 100) * lw;
    const by = ly + (b.top / 100) * lh;
    const bw = (b.width / 100) * lw;
    const bh = (b.height / 100) * lh;
    wishText(ctx, wish, bx + bw / 2, by + bh / 2, bw, lw * 0.076, family); // 화면: 풍등 폭의 7.6%
  } else {
    const b = WISH_BOX[1];
    wishText(ctx, wish, (b.cx / 100) * c.width, (b.cy / 100) * c.height, (b.w / 100) * c.width, c.width * 0.054, family); // 화면: 그림 폭의 5.4%
  }
  return c;
}
