"use client";
// 작심삼일 스토리 카드(세로 1080×1920)를 이 기기에서 그린다(요청문 3-5·14-3장).
// 바탕 그림에 제목·일차·도장이 이미 있어 코드로 쓰지 않는다. 얹는 것: 사진(x180 y430 720×720) · 메모(x180 y1180 720×220, 없으면 날짜) ·
// 맨 아래 두 공식 계정 이름(작게). 오늘의 행동·주소는 넣지 않는다(대표님 2026-11-25: 사진과 한 줄 말만 담아 스토리에 올리는 카드).
// 사진이 없는 날: 한 줄 메모면 사진 칸에 메모를 크게, 체크만이면 큰 체크 도장.
import type { Method } from "./state";

export const CARD_W = 1080;
export const CARD_H = 1920;
const INK = "#5a3a1e";
export const CARD_ACCOUNTS = "@ssol.swhmkt  @ssol.wellness";
export const cardArt = (day: 1 | 2 | 3 | "all") => `/challenge/card${day === "all" ? "-all" : day}.webp`;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

// 글꼴이 다 불러진 뒤에 그린다(안 그러면 다른 글꼴로 찍힘). 실패해도 그리기는 이어 간다.
async function ensureFont(family: string, text: string) {
  try {
    await Promise.all([document.fonts.load(`700 60px ${family}`, text || "가"), document.fonts.load(`400 60px ${family}`, text || "가")]);
  } catch {
    /* 기본 글꼴로 */
  }
}

// 글자 단위로 줄을 나눈다(한글은 띄어쓰기 없이도 줄이 바뀌어야 함). maxLines를 넘으면 마지막 줄 끝을 …로.
export function wrapLines(measure: (s: string) => number, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  const push = (s: string) => lines.push(s);
  for (const w of words) {
    const cand = line ? `${line} ${w}` : w;
    if (measure(cand) <= maxWidth) {
      line = cand;
      continue;
    }
    if (line) push(line);
    line = "";
    for (const ch of [...w]) {
      if (measure(line + ch) > maxWidth && line) {
        push(line);
        line = ch;
      } else line += ch;
    }
  }
  if (line) push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && measure(`${last}…`) > maxWidth) last = [...last].slice(0, -1).join("");
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

function drawText(ctx: CanvasRenderingContext2D, text: string, box: { x: number; y: number; w: number; h: number }, size: number, maxLines: number, family: string, weight = 700) {
  let s = size;
  let lines: string[] = [];
  for (; s >= 34; s -= 4) {
    ctx.font = `${weight} ${s}px ${family}`;
    lines = wrapLines((t) => ctx.measureText(t).width, text, box.w, maxLines);
    if (lines.length * s * 1.25 <= box.h) break;
  }
  const lh = s * 1.25;
  const top = box.y + (box.h - lines.length * lh) / 2 + lh / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, box.x + box.w / 2, top + i * lh));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function checkStamp(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.fillStyle = "#f3b04c";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3b2208";
  ctx.lineWidth = r * 0.16;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.45, cy + r * 0.02);
  ctx.lineTo(cx - r * 0.1, cy + r * 0.36);
  ctx.lineTo(cx + r * 0.5, cy - r * 0.34);
  ctx.stroke();
  ctx.restore();
}

function accounts(ctx: CanvasRenderingContext2D, family: string) {
  ctx.save();
  ctx.font = `700 34px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.shadowColor = "rgba(0,0,0,.55)";
  ctx.shadowBlur = 8;
  ctx.fillText(CARD_ACCOUNTS, CARD_W / 2, CARD_H - 44);
  ctx.restore();
}

export type DayCardInput = { day: 1 | 2 | 3; method: Method; photoUrl: string | null; memo: string | null; dateLabel: string };

export async function drawDayCard(input: DayCardInput, family: string): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const fallbackLine = `${input.dateLabel} · 오늘의 인증`;
  await ensureFont(family, `${input.memo ?? ""}${fallbackLine}${CARD_ACCOUNTS}`);
  ctx.drawImage(await loadImage(cardArt(input.day)), 0, 0, CARD_W, CARD_H);
  const photoBox = { x: 180, y: 430, w: 720, h: 720 };
  const memoBox = { x: 180, y: 1180, w: 720, h: 220 };
  ctx.fillStyle = INK;
  if (input.photoUrl) {
    const img = await loadImage(input.photoUrl);
    ctx.save();
    roundRect(ctx, photoBox.x, photoBox.y, photoBox.w, photoBox.h, 28);
    ctx.clip();
    ctx.drawImage(img, photoBox.x, photoBox.y, photoBox.w, photoBox.h);
    ctx.restore();
    ctx.fillStyle = INK;
    drawText(ctx, input.memo || fallbackLine, memoBox, 64, 2, family);
  } else if (input.method === "memo" && input.memo) {
    drawText(ctx, input.memo, { x: photoBox.x + 30, y: photoBox.y + 40, w: photoBox.w - 60, h: photoBox.h - 80 }, 96, 5, family);
    drawText(ctx, fallbackLine, memoBox, 56, 1, family);
  } else {
    checkStamp(ctx, CARD_W / 2, photoBox.y + photoBox.h / 2, 220);
    ctx.fillStyle = INK;
    drawText(ctx, input.memo || fallbackLine, memoBox, 60, 2, family);
  }
  accounts(ctx, family);
  return c;
}

// "3일 모두 완료" 카드(대표님 2026-11-25: 완료 화면에 씀) — 사진 칸 자리에 1·2·3일차를 한 줄씩(작은 사진 + 메모/행동), 메모 칸에 "3일을 모두 채웠어요!".
export type CompleteItem = { n: number; thumbUrl: string | null; text: string };
export async function drawCompleteCard(items: CompleteItem[], family: string): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas");
  await ensureFont(family, items.map((i) => i.text).join("") + "3일을 모두 채웠어요!일차" + CARD_ACCOUNTS);
  ctx.drawImage(await loadImage(cardArt("all")), 0, 0, CARD_W, CARD_H);
  const rowH = 240;
  for (const [i, it] of items.slice(0, 3).entries()) {
    const y = 430 + i * rowH;
    const t = 190;
    if (it.thumbUrl) {
      const img = await loadImage(it.thumbUrl);
      ctx.save();
      roundRect(ctx, 190, y + (rowH - t) / 2, t, t, 20);
      ctx.clip();
      ctx.drawImage(img, 190, y + (rowH - t) / 2, t, t);
      ctx.restore();
    } else {
      checkStamp(ctx, 190 + t / 2, y + rowH / 2, t * 0.42);
    }
    ctx.fillStyle = "#c8801a";
    ctx.font = `700 46px ${family}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${it.n}일차`, 410, y + 70);
    ctx.fillStyle = INK;
    ctx.font = `700 44px ${family}`;
    const lines = wrapLines((s) => ctx.measureText(s).width, it.text, 470, 2);
    lines.forEach((l, j) => ctx.fillText(l, 410, y + 130 + j * 54));
  }
  ctx.fillStyle = INK;
  drawText(ctx, "3일을 모두 채웠어요!", { x: 180, y: 1180, w: 720, h: 220 }, 72, 1, family);
  accounts(ctx, family);
  return c;
}

export const canvasToBlob = (c: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/png"));
