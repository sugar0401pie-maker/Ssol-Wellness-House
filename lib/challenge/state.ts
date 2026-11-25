// 작심삼일 챌린지 상태와 화면 문구 — 순수 함수(요청문 v1.9.4 3·9·13장). 서버(app/api/challenge)와 화면이 같이 쓴다.
// 규칙: N번째 저장 = N일차 · 하루 한 번(KST, 서버 날짜) · 연속 아니고 시작 후 7일 안에 누적 3번 · 3번이면 완료(다시 하기 = 또심삼일, 횟수 제한 없음).
// 리워드는 계정당 1번(내용은 미정 — 지급 기록만 남긴다). 실패·벌칙 표현은 쓰지 않는다. 클라이언트도 쓰므로 "server-only"를 넣지 않는다.

export const CHALLENGE_DAYS = 3;
export const WINDOW_DAYS = 7; // 시작일 포함 7일(시작일 + 6일)
export const MEMO_MAX = 40;
export type Method = "photo" | "memo" | "check";
export const METHODS: Method[] = ["photo", "memo", "check"];

export type Checkin = { n: number; day: string; method: Method; memo: string | null; action: string };
export type Challenge = { id: string; seq: number; theme: string; startedDay: string; status: "active" | "done" | "expired"; endedDay: string | null; endReason: string | null; checkins: Checkin[] };

// "YYYY-MM-DD"(KST 날짜 문자열) 계산 — 시간대와 상관없게 UTC 자정으로만 다룬다.
const ms = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
export const dayDiff = (a: string, b: string): number => Math.round((ms(a) - ms(b)) / 86_400_000); // a - b
export function addDays(d: string, n: number): string {
  const t = new Date(ms(d) + n * 86_400_000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}
export const shortDate = (d: string): string => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;

export function normalizeMemo(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.replace(/\s+/g, " ").trim();
  if (!s) return null;
  return [...s].slice(0, MEMO_MAX).join("");
}

export type ViewKind = "pre" | "wait" | "todo" | "doneToday" | "expired" | "complete";
export type View = {
  kind: ViewKind;
  n: number; // 오늘 저장하면 몇 일차인지(todo) 또는 마지막으로 저장한 일차
  stamped: number; // 찍힌 도장 수
  todayLine: string; // 도장 아래 큰 줄(없으면 "")
  msg: string; // 안내(없으면 "")
  button: { label: string; enabled: boolean; op: "start" | "checkin" | "restart" | null };
  dayIndex: number | null; // 오늘의 행동(0~2), 없으면 null
};

// 지금 보여 줄 챌린지(닫지 않은 것) · 오늘 · 리워드를 받았는지 · 오늘 다른 챌린지로 이미 저장했는지 → 화면 상태.
export function deriveView(c: Challenge | null, today: string, rewarded: boolean): View {
  if (!c) {
    return {
      kind: "pre", n: 1, stamped: 0, todayLine: "", dayIndex: null,
      msg: rewarded ? "시작하면 그날이 1일차예요." : "시작하면 그날이 1일차예요.\n챌린지 종료 이후에 깜짝 리워드가 있어요!" /* 대표님 2026-11-25: 두 문장 줄바꿈 */,
      button: { label: "챌린지 시작", enabled: true, op: "start" },
    };
  }
  const done = c.checkins.length;
  const last = c.checkins[done - 1];
  if (done >= CHALLENGE_DAYS) {
    return { kind: "complete", n: CHALLENGE_DAYS, stamped: CHALLENGE_DAYS, todayLine: "와! 3일차 챌린지를 완료했어요!", msg: "", dayIndex: null, button: { label: "다시 챌린지 하기 (또심삼일!)", enabled: true, op: "restart" } };
  }
  if (dayDiff(c.startedDay, today) > 0) {
    // 같은 날 끝내고 바로 새로 시작 — 1일차는 내일부터(하루 한 번 규칙)
    return { kind: "wait", n: 1, stamped: 0, todayLine: "내일이 1일차예요", msg: "오늘은 이미 인증했어요. 1일차는 내일 만나요~", dayIndex: 0, button: { label: "내일 1일차에 만나요~", enabled: false, op: null } };
  }
  if (last && last.day === today) {
    const msg = done === 1 ? "1일차 완료 대박~! 내일은 2일차예요." : "2일차도 해냈네요 짱이에요~! 내일은 3일차예요. 하나만 더 하면 완료예요.";
    return { kind: "doneToday", n: done, stamped: done, todayLine: `오늘 ${done}일차 완료`, msg, dayIndex: done - 1, button: { label: `오늘 인증 끝! 내일은 ${done + 1}일차예요~`, enabled: false, op: null } };
  }
  if (dayDiff(today, c.startedDay) >= WINDOW_DAYS) {
    return { kind: "expired", n: done, stamped: done, todayLine: "다시 시작할 수 있어요", msg: "이번엔 여기까지 왔어요. 괜찮아요, 다시 해봐요. 또 할 수 있어요~", dayIndex: null, button: { label: "다시 시작", enabled: true, op: "restart" } };
  }
  const n = done + 1;
  const lastActive = last ? last.day : c.startedDay;
  let msg = "오늘도 하나만 해봐요~";
  if (!last && c.startedDay === today) msg = "시작했어요! 오늘이 1일차예요. 가볍게 해봐요~";
  else if (dayDiff(today, lastActive) >= 2 || (!last && dayDiff(today, c.startedDay) >= 1)) msg = "어제는 쉬었죠? 괜찮아요, 오늘부터 이어서 가요~";
  return { kind: "todo", n, stamped: done, todayLine: `오늘은 ${n}일차`, msg, dayIndex: n - 1, button: { label: "저장하기", enabled: true, op: "checkin" } };
}

// 하단 메뉴 갓생러모임의 빨간 점 — 오늘 저장할 차례인데 아직 안 했을 때만(완료·오늘 저장·시작 전·내일부터면 없음).
export const needsToday = (v: View): boolean => v.kind === "todo";

// 새 챌린지의 시작일 — 오늘 이미 저장(다른 챌린지)했으면 내일부터.
export const startDayFor = (today: string, checkedInToday: boolean): string => (checkedInToday ? addDays(today, 1) : today);

// 기록에 남길지(다시 하기로 닫을 때) — 저장한 날이 하루라도 있으면.
export const keepInHistory = (c: Pick<Challenge, "checkins">): boolean => c.checkins.length > 0;

// 홈 배너 ②(요청문 8-2장) — 상태별 제목·설명. 3번 다 채웠으면 숨김(null).
export function bannerCopy(v: View): { title: string; desc: string } | null {
  switch (v.kind) {
    case "pre":
      return { title: "쏠 작심삼일 챌린지", desc: "3일만 해봐요. 하루 쉬어도 괜찮아요." };
    case "wait":
      return { title: "내일이 1일차예요", desc: "내일 만나요~" };
    case "todo":
      return { title: `오늘은 ${v.n}일차`, desc: "사진 한 줄로 인증하러 가기" };
    case "doneToday":
      return { title: `오늘 ${v.n}일차 완료`, desc: `내일은 ${v.n + 1}일차예요` };
    case "expired":
      return { title: "챌린지를 다시 해 볼까요?", desc: "괜찮아요, 또 할 수 있어요" };
    case "complete":
      return null;
  }
}

// 결과 화면(13-9장) 줄
export const resultLine = (n: number): string => (n >= CHALLENGE_DAYS ? "3일을 모두 채웠어요!" : `${n}일차 도장을 찍었어요. 내일은 ${n + 1}일차예요.`);
