// 풍등 날리기(홈 화면 개편 요청문 v1.9.4 2장·14-2장, 2026-11-25) — 순수 설정·판단. 클라이언트도 쓰므로 "server-only"를 넣지 않는다.
// 누구나(로그인) 소원을 한 줄 적어 하루 한 번(KST) 날린다. 이용권은 필요 없다. 챌린지와는 별개(v1.9.1). 금빛 풍등 없음.

// 이벤트 기간(요청문 0장 4번 기본값). 서버는 환경 변수 SW_LANTERN_START·SW_LANTERN_END(YYYY-MM-DD, KST)로 바꿀 수 있다.
export const LANTERN_DEFAULT_START = "2026-11-26";
export const LANTERN_DEFAULT_END = "2026-12-31";
export const WISH_MAX = 40; // 한글 40자(글자 단위)

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export function lanternPeriod(env: { SW_LANTERN_START?: string; SW_LANTERN_END?: string } = {}): { start: string; end: string } {
  const start = env.SW_LANTERN_START && DAY.test(env.SW_LANTERN_START) ? env.SW_LANTERN_START : LANTERN_DEFAULT_START;
  const end = env.SW_LANTERN_END && DAY.test(env.SW_LANTERN_END) ? env.SW_LANTERN_END : LANTERN_DEFAULT_END;
  return { start, end };
}
// todayKey = KST 날짜("YYYY-MM-DD"). 시작일·종료일 모두 포함.
export const isLanternOpen = (todayKey: string, p: { start: string; end: string }): boolean => todayKey >= p.start && todayKey <= p.end;

// 소원 글: 앞뒤 공백을 빼고 줄바꿈·여러 칸 띄움은 한 칸으로. 비었거나 40자를 넘으면 null.
export function normalizeWish(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.replace(/\s+/g, " ").trim();
  if (!s || [...s].length > WISH_MAX) return null;
  return s;
}

// 장면(그림 1080×2160 기준 비율). 풍등 가운데·크기는 그림에서 잰 값 — 소원 글자는 장면 1·2에서 풍등을 따라가고, 장면 3부터 흐려진다(대표님 2026-11-25).
export const LANTERN_SCENES = [
  { n: 1, src: "/lantern/scene1.webp", alt: "수달과 해달이 풍등을 함께 들고 하늘을 올려다봐요" },
  { n: 2, src: "/lantern/scene2.webp", alt: "두 친구가 손을 놓자 풍등이 살짝 떠올라요" },
  { n: 3, src: "/lantern/scene3.webp", alt: "풍등이 더 높이 올라가요" },
  { n: 4, src: "/lantern/scene4.webp", alt: "풍등이 하늘 멀리 작아져요" },
  { n: 5, src: "/lantern/scene5.webp", alt: "두 친구가 박수를 쳐요" },
] as const;
// 글자 자리(%, 풍등 몸통 가운데) — 원본 장면 1: 풍등 x168~924·y400~1284, 장면 2: x192~904·y312~1116, 장면 3: x224~760·y152~928.
// 장면 1~4 원본은 가장자리에 흰 테두리가 있어 x16~1064·y32~2128을 잘라 1080×2160으로 되돌렸다(public/lantern) — 아래 값은 자른 뒤 기준.
// 장면 3에서는 풍등을 따라 옮겨 가며 흐려진다(장면 4부터는 보이지 않음).
export const WISH_BOX = {
  1: { cx: 50.6, cy: 38.7, w: 46 }, // w = 글자 상자 폭(그림 폭의 %)
  2: { cx: 50.7, cy: 32.6, w: 42 },
  3: { cx: 45.5, cy: 24.8, w: 32 },
} as const;
// 장면 시간(ms): 2 → 3 → 4, 그다음 끝 화면(장면 5).
export const SCENE_MS = { 2: 1500, 3: 1500, 4: 5000 } as const;
export const LANTERN_DONE_TEXT = "풍등이 잘 날아갔어요!"; // 요청문 14-2장(작은 글씨 "소원은 천천히 흐려져요"는 쓰지 않음 — 대표님 2026-11-25)
export const LANTERN_ALREADY_TEXT = "오늘 풍등은 벌써 날렸어요. 내일 또 올려 보내요.";
