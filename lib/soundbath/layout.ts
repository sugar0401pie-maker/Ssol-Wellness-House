// 사운드 배스 배치(요청문 v1.9.4 14-4장, 03_그림/1_사운드배스 좌표 — 그림 1080×2160 기준). 순수 계산이라 화면과 테스트가 같이 쓴다.
// 층: 배경 → 해달 → 보울 → 누르는 영역(투명 버튼). 보울 번호는 왼쪽에서 오른쪽.
// 해달 그림은 보이는 부분만 잘라 둔 것(public/soundbath/otterN.webp)이고, rect는 그 잘린 그림의 자리(시안과 같은 값).
// 해달은 채 끝이 닿는 점(rc)을 기준으로 2.7배 키운다 — 키워도 채 끝이 보울 가장자리에 닿는다. 화면 밖으로 나가면 안쪽으로 당긴다.
export const W = 1080;
export const H = 2160;
export const OTTER_K = 2.7;
export const REST_POSE = 3; // 처음·쉬는 동안: 가운데 앉기(자세3), 소리 없음
export const RETURN_MS = 4500; // 친 뒤 자세3으로 돌아오기
export const RIPPLE_MS = 2600;
export const TOUR_GAP_MS = 2000; // 차례로 울리기 간격
export const AUTO_MIN_MS = 3200; // 알아서 울리기 3.2~5.6초
export const AUTO_SPAN_MS = 2400;
export const HIT_PAD = 10;

export type Bowl = { id: number; rect: [number, number, number, number]; freq: number; name: string };
// 음 높이: 큰 보울일수록 낮게(시안과 같은 음). 녹음한 소리 파일(bowl-1~5.mp3)이 오면 같은 번호로 바꾼다.
export const BOWLS: Bowl[] = [
  { id: 1, rect: [48, 1653, 119, 106], freq: 392, name: "왼쪽 첫 번째 작은 보울" },
  { id: 2, rect: [189, 1662, 173, 153], freq: 293.7, name: "왼쪽 두 번째 보울" },
  { id: 3, rect: [384, 1664, 194, 172], freq: 220, name: "가운데 보울" },
  { id: 4, rect: [599, 1633, 238, 211], freq: 174.6, name: "오른쪽 가장 큰 보울" },
  { id: 5, rect: [864, 1644, 140, 124], freq: 329.6, name: "오른쪽 끝 작은 보울" },
];
export const POSES: Record<number, { rect: [number, number, number, number]; rc: [number, number] }> = {
  1: { rect: [158.58, 1422.92, 292.96, 299.98], rc: [163, 1670] },
  2: { rect: [351.03, 1440.32, 224.9, 300.35], rc: [355, 1686] },
  3: { rect: [377.24, 1373.62, 225.67, 299.62], rc: [481, 1669] },
  4: { rect: [322.65, 1427.32, 290.99, 299.75], rc: [609, 1667] },
  5: { rect: [588.58, 1424.3, 287.08, 300.29], rc: [870, 1664] },
};

const pct = (v: number, of: number) => (v / of) * 100;

// 해달 자세 n을 그릴 자리(그림 폭·높이에 대한 %).
export function posePlacement(n: number): { left: number; top: number; width: number } {
  const p = POSES[n] ?? POSES[REST_POSE];
  const [x, y, w] = p.rect;
  const [cx, cy] = p.rc;
  const width = pct(w * OTTER_K, W);
  const left = Math.max(0, Math.min(100 - width, pct(cx + (x - cx) * OTTER_K, W)));
  return { left, top: pct(cy + (y - cy) * OTTER_K, H), width };
}

// 누르는 영역: 보울 자리에서 위·아래·옆으로 10씩 넓힌다.
export function hitArea(b: Bowl): { left: number; top: number; width: number; height: number } {
  const [x, y, w, h] = b.rect;
  return { left: pct(x - HIT_PAD, W), top: pct(y - HIT_PAD, H), width: pct(w + HIT_PAD * 2, W), height: pct(h + HIT_PAD * 2, H) };
}

// 알아서 울리기: 바로 전 보울을 빼고 고른다(rand 0~1).
export function nextAutoBowl(last: number | null, rand: number): number {
  const pool = BOWLS.map((b) => b.id).filter((id) => id !== last);
  return pool[Math.min(pool.length - 1, Math.floor(Math.max(0, rand) * pool.length))];
}
