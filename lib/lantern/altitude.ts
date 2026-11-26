// 이미 풍등을 날린 사람에게 보여 줄 "지금도 올라가고 있어요" 문장(대표님 2026-11-25: 새해까지 한 번만, 이미 날렸으면
// "당신의 풍등은 지금 성층권을 지나 203,001km 상공에 가고 있어요"처럼 계속 올라간다는 말을 무작위로).
// 높이는 날린 시각부터 시속 600km로 계속 올라간 것으로 계산한다 — 다시 열 때마다 숫자가 커지고, 화면을 보는 동안에도 올라간다.
// (2주쯤 지나면 약 20만km — 대표님 예시와 비슷한 크기, 27일쯤 달 거리.) 문장은 높이에 맞는 것 중에서 고른다(성층권 문장이 달 너머에 나오지 않게).
// 클라이언트도 쓰므로 "server-only"를 넣지 않는다.

export const RISE_KMH = 600;
export const START_KM = 1;
export const MOON_KM = 384_400;

export function altitudeKm(flownAtIso: string, nowMs: number): number {
  const t = Date.parse(flownAtIso);
  if (!Number.isFinite(t)) return START_KM;
  const hours = Math.max(0, nowMs - t) / 3_600_000;
  return Math.floor(START_KM + hours * RISE_KMH);
}

export const formatKm = (km: number): string => `${Math.max(0, Math.floor(km)).toLocaleString("ko-KR")}km`;

type Line = { min: number; max: number; text: string }; // min 이상 max 미만에서만 쓴다
// {who} = "○○님의" 또는 "당신의", {km} = "203,001km", {pct} = 달까지 간 비율
export const ALTITUDE_LINES: Line[] = [
  { min: 0, max: 12, text: "{who} 풍등은 지금 구름을 뚫고 {km} 상공을 지나고 있어요." },
  { min: 0, max: 12, text: "{who} 풍등은 지금 마을 불빛을 내려다보며 {km} 상공으로 올라가고 있어요." },
  { min: 12, max: 50, text: "{who} 풍등은 지금 성층권에 들어서 {km} 상공을 날고 있어요." },
  { min: 12, max: 50, text: "{who} 풍등은 지금 비행기보다 높이, {km} 상공을 지나고 있어요." },
  { min: 50, max: 100, text: "{who} 풍등은 지금 성층권을 지나 {km} 상공에 가고 있어요." },
  { min: 100, max: 400, text: "{who} 풍등은 지금 하늘의 끝을 넘어 {km} 상공에 가고 있어요." },
  { min: 400, max: 36_000, text: "{who} 풍등은 지금 우주정거장보다 높이, {km} 상공을 지나고 있어요." },
  { min: 400, max: 36_000, text: "{who} 풍등은 지금 지구를 한눈에 내려다보며 {km} 상공을 날고 있어요." },
  { min: 36_000, max: MOON_KM, text: "{who} 풍등은 지금 별들 사이를 지나 {km} 상공에 가고 있어요." },
  { min: 36_000, max: MOON_KM, text: "{who} 풍등은 지금 {km} 상공, 달까지 가는 길의 {pct}%를 지났어요." },
  { min: MOON_KM, max: Infinity, text: "{who} 풍등은 지금 달을 지나 {km} 떨어진 먼 하늘로 가고 있어요." },
  { min: MOON_KM, max: Infinity, text: "{who} 풍등은 지금 달에게 인사하고 {km} 너머로 올라가고 있어요." },
  // 어느 높이에서나
  { min: 0, max: Infinity, text: "{who} 풍등은 지금도 {km} 상공을 향해 조용히 올라가고 있어요." },
  { min: 0, max: Infinity, text: "{who} 풍등은 소원을 품은 채 {km} 상공을 지나는 중이에요.\n아직 올라가고 있어요." }, // 대표님 2026-11-26: 두 번째 문장은 줄을 바꿔서
];

export function pickAltitudeLine(km: number, rand: number): Line {
  const fit = ALTITUDE_LINES.filter((l) => km >= l.min && km < l.max);
  return fit[Math.min(fit.length - 1, Math.floor(Math.max(0, Math.min(0.9999, rand)) * fit.length))];
}

export function renderAltitudeLine(line: Line, km: number, name: string | null | undefined): string {
  const n = name?.trim();
  const who = n ? `${n}님의` : "당신의";
  const pct = Math.min(99, Math.floor((km / MOON_KM) * 100));
  return line.text.replace("{who}", who).replace("{km}", formatKm(km)).replace("{pct}", String(pct));
}
