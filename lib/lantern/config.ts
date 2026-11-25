// 풍등 날리기(홈 화면 개편 요청문 v1.9.4 2장·14-2장, 2026-11-25) — 순수 설정·판단. 클라이언트도 쓰므로 "server-only"를 넣지 않는다.
// 누구나(로그인) 소원을 한 줄 적어 이벤트 기간에 한 번 날린다(대표님 2026-11-25: 새해까지 한 번만 — 처음에는 하루 한 번이었음). 이용권은 필요 없다. 챌린지와는 별개(v1.9.1). 금빛 풍등 없음.

// 이벤트 기간(요청문 0장 4번 기본값). 서버는 환경 변수 SW_LANTERN_START·SW_LANTERN_END(YYYY-MM-DD, KST)로 바꿀 수 있다.
export const LANTERN_DEFAULT_START = "2026-11-25"; // 대표님 2026-11-25 "풍등 지금 열리게" — 원래 11-26
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
// 한 번만 날리는 단위 — 기간 시작일로 이름을 붙여, 다음 이벤트(기간을 새로 정하면)에는 다시 날릴 수 있다.
// 앱을 "/"로 열었을 때 그날 첫 번째면 풍등 화면으로 먼저 보낼지(요청문 8-3장 — 하루 한 번, "나중에 할게요"로 건너뜀).
export const LANTERN_ENTRY_REDIRECT = true;
export const entryRedirectKey = (todayKey: string): string => `ssol.lanternEntry.${todayKey}`;

export const lanternEventKey = (p: { start: string }): string => `lantern-${p.start}`;

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
  // 장면 5: 대표님 2026-11-25 새 축하 그림("2027년의 소원을 담은 / 풍등이 잘 날아갔어요!" 손글씨가 그림 안에 — 수달·해달 판)
  { n: 5, src: "/lantern/celebrate.webp", alt: "수달과 해달이 박수를 쳐요. 2027년의 소원을 담은 풍등이 잘 날아갔어요!" },
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
export const LANTERN_DONE_TEXT = "풍등이 잘 날아갔어요!"; // 이제 축하 그림 안에 손글씨로 들어 있어 화면에 따로 쓰지 않는다(화면 읽기용으로만)
// 축하 그림의 글자 상자 바로 아래(그림 높이의 %) — "지금 몇 km 상공" 줄을 놓는 자리(대표님: 글자 밑에 얼마나 날아가고 있는지)
export const CELEBRATE_TEXT_BOTTOM = 48.5; // 요청문 14-2장(작은 글씨 "소원은 천천히 흐려져요"는 쓰지 않음 — 대표님 2026-11-25)
export const LANTERN_ALREADY_SUB = "풍등은 새해까지 한 번 날릴 수 있어요."; // 위 문장이 이미 "올라가고 있어요"라 겹치지 않게 짧게

// 날리기를 누른 뒤 장면이 이어지는 동안(저장도 이때 함께 한다) 2초마다 바뀌는 안내(대표님 2026-11-25 — 앞의 두 문장은 대표님 문구).
// 저장이 장면보다 늦게 끝나면 장면 4에 머문 채 계속 돌아간다.
export const FLYING_CAPTIONS = [
  "소중한 마음을 풍등에 담고 있어요…",
  "풍등에 열심히 소원을 적고 있어요…",
  "바람을 타고 풍등이 높이 올라가요…",
  "별들에게 소원을 전하러 가고 있어요…",
] as const;
export const CAPTION_MS = 2000;
