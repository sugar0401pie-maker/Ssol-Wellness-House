// 고민 글자 구름 배치(요청문 10-3장, 시안의 layoutCloud와 같은 계산) — 순수 함수.
// 글자 크기 = 3.4 + 점수 × 1.15 (cqw, 상자가 낮으면 넓이 비율만큼 고르게 줄임). 상자 폭 88 · 높이 44(cqw, 2026-11-26 66에서 줄임). 점수가 큰 글자부터 가운데에서 나선형으로 퍼지며 겹치지 않는 자리에 놓고,
// 안 들어가면 10%씩 줄여 다시 놓는다. 상자 밖으로 나가지 않는다.
export type CloudItem = { key: string; label: string; score: number };
export type Placed = { x: number; y: number; f: number; w: number; h: number };

export const fontFor = (score: number) => 3.4 + score * 1.15;
const boxOf = (label: string, f: number) => ({ w: f * (0.62 + [...label].length * 1.0), h: f * 1.3 });

// 글자 구름 상자 크기(cqw). 대표님 2026-11-26: 세로를 66 → 44로 줄임.
export const CLOUD_W = 88;
export const CLOUD_H = 44;

export function layoutCloud(items: CloudItem[], W = CLOUD_W, H = CLOUD_H): Record<string, Placed> {
  const sorted = items.map((it, i) => ({ ...it, i })).sort((a, b) => b.score - a.score || a.i - b.i);
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const out: Record<string, Placed> = {};
  const pad = 1.2;
  const cx = W / 2;
  const cy = H / 2;
  // 상자가 원래(66)보다 낮으면 넓이 비율만큼 모든 글자를 고르게 줄인다(일부 글자만 아주 작아지지 않게, 2026-11-26)
  const shrink = Math.min(1, Math.sqrt(H / 66));
  sorted.forEach((it, k) => {
    let f = fontFor(it.score) * shrink;
    let ok = false;
    for (let tries = 0; !ok && tries < 6; tries++) {
      const { w: bw, h: bh } = boxOf(it.label, f);
      for (let a = 0; a < 2400 && !ok; a++) {
        const ang = a * 0.45 + k * 1.3;
        const rad = 0.35 * Math.pow(a, 0.62) * 3.0;
        const x = cx + Math.cos(ang) * rad * 1.45 - bw / 2;
        const y = cy + Math.sin(ang) * rad * 0.9 - bh / 2;
        if (x < 1.5 || y < 1.5 || x + bw > W - 1.5 || y + bh > H - 1.5) continue;
        const hit = placed.some((p) => !(x + bw + pad < p.x || p.x + p.w + pad < x || y + bh + pad < p.y || p.y + p.h + pad < y));
        if (!hit) {
          placed.push({ x, y, w: bw, h: bh });
          out[it.key] = { x, y, f, w: bw, h: bh };
          ok = true;
        }
      }
      // 나선이 빈 구석을 지나쳤을 수 있어, 줄이기 전에 상자 전체를 촘촘히 훑어 빈자리를 찾는다(2026-11-26, 상자를 낮춘 뒤 긴 태그가 너무 작아지던 것)
      for (let y = 1.5; !ok && y + bh <= H - 1.5; y += 0.5)
        for (let x = 1.5; !ok && x + bw <= W - 1.5; x += 0.5) {
          const hit = placed.some((p) => !(x + bw + pad < p.x || p.x + p.w + pad < x || y + bh + pad < p.y || p.y + p.h + pad < y));
          if (!hit) {
            placed.push({ x, y, w: bw, h: bh });
            out[it.key] = { x, y, f, w: bw, h: bh };
            ok = true;
          }
        }
      if (!ok) f *= 0.9;
    }
    if (!ok) {
      const ff = fontFor(it.score) * shrink * 0.8;
      const b = boxOf(it.label, ff);
      out[it.key] = { x: 2 + (k % 3) * 28, y: 2 + k * 5, f: ff, ...b };
    }
  });
  return out;
}

// 점수 → 글자 색(높을수록 따뜻한 노랑, 낮을수록 차가운 색)·굵기
const COLORS = ["#8fb4e3", "#bcd0ea", "#f6e3b4", "#ffd36b", "#ffd36b"];
export const colorFor = (score: number) => COLORS[Math.max(0, Math.min(4, Math.round(score) - 1))];
export const boldFor = (score: number) => score >= 4;
