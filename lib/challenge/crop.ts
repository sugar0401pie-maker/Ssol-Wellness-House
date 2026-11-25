// 사진을 정사각형으로 자르는 계산(요청문 3-4장: 끌어서 위치, 슬라이더로 확대) — 순수 함수. 화면 미리보기와 카드용 720×720 출력이 같은 계산을 쓴다.
// zoom 1 = 짧은 변이 정사각형을 꽉 채움(기본: 가운데). ox·oy = 가운데에서 옮긴 거리(출력 크기에 대한 비율, -0.5~0.5 범위에서 잘림).
export type Crop = { zoom: number; ox: number; oy: number };
export const CROP_DEFAULT: Crop = { zoom: 1, ox: 0, oy: 0 };
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;

// 그림이 정사각형 밖으로 빈 곳 없이 덮도록 옮긴 거리를 제한한다.
export function clampCrop(c: Crop, w: number, h: number): Crop {
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, c.zoom || 1));
  const s = zoom / Math.min(w, h); // 정사각형 한 변(=1)에 대한 배율
  const maxX = Math.max(0, (w * s - 1) / 2);
  const maxY = Math.max(0, (h * s - 1) / 2);
  const clip = (v: number, m: number) => Math.min(m, Math.max(-m, Number.isFinite(v) ? v : 0));
  return { zoom, ox: clip(c.ox, maxX), oy: clip(c.oy, maxY) };
}

// size×size 칸에 그릴 위치(그림 전체의 좌상단 x·y와 그린 폭·높이).
export function cropRect(c: Crop, w: number, h: number, size: number): { x: number; y: number; dw: number; dh: number } {
  const k = clampCrop(c, w, h);
  const s = (k.zoom / Math.min(w, h)) * size;
  const dw = w * s;
  const dh = h * s;
  return { x: (size - dw) / 2 + k.ox * size, y: (size - dh) / 2 + k.oy * size, dw, dh };
}
