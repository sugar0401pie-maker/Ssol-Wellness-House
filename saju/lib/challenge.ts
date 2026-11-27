// 작심삼일 챌린지 → 쏘웰라(app.ssolwellnesshouse.com)로 넘기는 다섯 칸.
// 쏘웰라가 쏠 타로에서 받는 모양과 똑같이 맞춘다(메인 저장소 lib/challenge/tarotPlan.ts):
//   { day1, day2, day3, week, month } — 칸 = { title (80자 이하), description (300자 이하, 없어도 됨) }
// 1·2·3일차 제목이 모두 있어야 쏘웰라가 계획으로 받는다. 문장은 엔진(challenge.json)이 고른 것을 그대로 쓴다.
// 순수 함수 — 테스트: challenge.test.ts

export type HandoffSlot = { title: string; description: string | null };
export type HandoffChallenge = {
  day1: HandoffSlot;
  day2: HandoffSlot;
  day3: HandoffSlot;
  week: HandoffSlot | null;
  month: HandoffSlot | null;
};

type EngineSlot = { text?: string; why?: string; when?: string } | null | undefined;
type EngineChallenge = { days?: EngineSlot[]; week?: EngineSlot; month?: EngineSlot } | null | undefined;

const TITLE_MAX = 80;
const DESC_MAX = 300;
const clean = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "");
const cut = (s: string, max: number) => ([...s].length > max ? [...s].slice(0, max - 1).join("") + "…" : s);

function daySlot(d: EngineSlot): HandoffSlot | null {
  const title = clean(d?.text);
  if (!title) return null;
  const why = clean(d?.why);
  return { title: cut(title, TITLE_MAX), description: why ? cut(why, DESC_MAX) : null };
}

// 1주일·1달 칸은 쏘웰라 예시처럼 제목을 "1주일 이어 가기" / "1달 이어 가기"로, 할 일은 설명에 넣는다.
function laterSlot(d: EngineSlot, title: string): HandoffSlot | null {
  const text = clean(d?.text);
  if (!text) return null;
  const when = clean(d?.when);
  const why = clean(d?.why);
  const desc = [when ? `${when} ${text}` : text, why].filter(Boolean).join(" — ");
  return { title, description: cut(desc, DESC_MAX) };
}

export function handoffChallenge(c: EngineChallenge): HandoffChallenge | null {
  const days = c?.days ?? [];
  const byDay = (n: number) => days.find((d) => (d as { day?: number } | null)?.day === n) ?? days[n - 1];
  const day1 = daySlot(byDay(1));
  const day2 = daySlot(byDay(2));
  const day3 = daySlot(byDay(3));
  if (!day1 || !day2 || !day3) return null;
  return { day1, day2, day3, week: laterSlot(c?.week, "1주일 이어 가기"), month: laterSlot(c?.month, "1달 이어 가기") };
}

/** 쏘웰라 챌린지로 넘어가는 주소(타로와 같은 모양: /challenge?from=…&result=…). */
export function sowellaChallengeUrl(resultId: string, base = process.env.NEXT_PUBLIC_SOWELLA_URL || "https://app.ssolwellnesshouse.com") {
  return `${base.replace(/\/+$/, "")}/challenge?from=saju&result=${encodeURIComponent(resultId)}`;
}
