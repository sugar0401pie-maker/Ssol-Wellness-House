// 고민 글자 구름 배치(요청문 10-3장, 시안의 layoutCloud와 같은 계산) — 순수 함수.
// 글자 크기 = 3.4 + 점수 × 1.15 (cqw). 상자 폭 88 · 높이 66(cqw). 점수가 큰 글자부터 가운데에서 나선형으로 퍼지며 겹치지 않는 자리에 놓고,
// 안 들어가면 10%씩 줄여 다시 놓는다. 상자 밖으로 나가지 않는다.
export type CloudItem = { key: string; label: string; score: number };
export type Placed = { x: number; y: number; f: number; w: number; h: number };

export const fontFor = (score: number) => 3.4 + score * 1.15;
const boxOf = (label: string, f: number) => ({ w: f * (0.62 + [...label].length * 1.0), h: f * 1.3 });

export function layoutCloud(items: CloudItem[], W = 88, H = 66): Record<string, Placed> {
  const sorted = items.map((it, i) => ({ ...it, i })).sort((a, b) => b.score - a.score || a.i - b.i);
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const out: Record<string, Placed> = {};
  const pad = 1.2;
  const cx = W / 2;
  const cy = H / 2;
  sorted.forEach((it, k) => {
    let f = fontFor(it.score);
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
      if (!ok) f *= 0.9;
    }
    if (!ok) {
      const ff = fontFor(it.score) * 0.8;
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
