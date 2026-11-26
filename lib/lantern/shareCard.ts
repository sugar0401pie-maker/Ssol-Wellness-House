"use client";
// 풍등을 날린 뒤 공유·저장할 그림(대표님 2026-11-26 "공유하기 누르면 축하하는 장면 공유"): 그 사람이 본 축하 그림(그림 묶음마다 다름) 위에,
// 화면과 같은 자리(celebrateTextBottom %)에 "지금 몇 km 상공" 한 줄을 얹는다. 소원 글은 넣지 않는다(개인적인 글이라 — 공유 그림에는 축하 장면만).
// 그림은 이 기기에서만 그린다(서버에 올리지 않음). 카카오톡으로 보낼 때만 카카오가 그림을 받아 간다(lib/challenge/share.ts).
import { ensureFont, loadImage, wrapLines } from "@/lib/challenge/card";

export const LANTERN_CARD_W = 1080;
export const LANTERN_CARD_H = 2160;

export async function drawLanternCard(input: { artUrl: string; line: string; textTopPct: number }, family: string): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = LANTERN_CARD_W;
  c.height = LANTERN_CARD_H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const [img] = await Promise.all([loadImage(input.artUrl), ensureFont(family, input.line)]);
  // 화면처럼 가득 채우기(object-cover)
  const s = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  ctx.drawImage(img, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
  if (input.line) {
    const font = 45; // 화면의 4.2cqw(1080 기준)
    ctx.font = `400 ${font}px ${family}`;
    const boxX = c.width * 0.09;
    const boxW = c.width * 0.82;
    const padX = 43;
    const padY = 37;
    const lines = wrapLines((t) => ctx.measureText(t).width, input.line, boxW - padX * 2, 4);
    const lh = font * 1.55;
    const boxY = (c.height * input.textTopPct) / 100;
    const boxH = padY * 2 + lh * lines.length;
    ctx.fillStyle = "rgba(8,20,42,.55)";
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 43);
    ctx.fill();
    ctx.fillStyle = "#fdf6e9"; // --night-text
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((l, i) => ctx.fillText(l, c.width / 2, boxY + padY + lh * i + lh / 2));
  }
  return c;
}
