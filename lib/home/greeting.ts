// 홈 탭 인사말 로직. "오늘은 이런 작은 변화를 한번 해볼까요?"라는 한 문장만 계속 보이던 것을,
// 2026-09-25 owner 요청으로 (1) 명절/공휴일이면 그 사실을 알려주고 (2) 평일에는 요일·날짜 기준으로
// 몇 가지 문구를 돌아가면서 보여주도록 바꿨다. 서버(daily-practice API)와 클라이언트 양쪽에서 같은
// dateKey 문자열(KST 기준 "YYYY-MM-DD")로 호출하면 항상 같은 결과가 나오도록 순수 함수로만 구성했다.

// 음력 공휴일(설날·추석)은 매년 날짜가 바뀐다 — 이 표는 해당 연도가 지나면 다음 해 날짜로
// 갱신해야 한다(양력 공휴일은 고정이라 갱신 불필요). 지금은 2026년만 채워뒀다.
// "쉬어가는" 명절(가족·축하 성격)과 "기리는" 기념일(엄숙한 성격)을 구분해서 문구 톤을 다르게 쓴다.
const REST_HOLIDAYS: Record<string, string> = {
  "2026-01-01": "신정",
  "2026-02-16": "설날 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날 연휴",
  "2026-05-05": "어린이날",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  "2026-12-25": "크리스마스",
};

const OBSERVANCE_HOLIDAYS: Record<string, string> = {
  "2026-03-01": "삼일절",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-10-03": "개천절",
  "2026-10-09": "한글날",
};

// 명절 연휴 동안은 실천방법도 "관계"(가족·지인) 쪽으로 살짝 기울여 보여준다 — 육아/가족 항목이
// 이 domain으로 재분류되어 있어(20260924000400 마이그레이션) 명절 분위기에 더 잘 맞는다.
export function holidayPracticeDomain(dateKey: string): string | null {
  return REST_HOLIDAYS[dateKey] ? "관계" : null;
}

function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).getDay(); // 0=일 ... 1=월
}

// 요일에 상관없이 매번 같은 날엔 같은 문구가 나오도록(새로고침해도 안 바뀌게) 날짜로 고른다.
function pick<T>(pool: T[], dateKey: string): T {
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) h = (h * 31 + dateKey.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}

function withName(displayName: string | null): string {
  return displayName ? `${displayName}님, ` : "";
}

const GENERIC_LINES: ((name: string) => string)[] = [
  (name) => `${name}오늘 기분은 어떠세요?`,
  () => "즐거운 하루 되세요.",
  () => "오늘도 무리하지 않는 하루 되시길 바라요.",
  (name) => `${name}잘 지내고 계신가요?`,
];

export function getGreetingLine(dateKey: string, displayName: string | null): string {
  const restHoliday = REST_HOLIDAYS[dateKey];
  if (restHoliday) return `오늘은 ${restHoliday}이에요. 마음 편히 쉬어가는 하루 되시길 바라요.`;

  const observance = OBSERVANCE_HOLIDAYS[dateKey];
  if (observance) return `오늘은 ${observance}이에요.`;

  if (weekdayOf(dateKey) === 1) return "활기찬 한 주의 시작이네요.";

  return pick(GENERIC_LINES, dateKey)(withName(displayName));
}
