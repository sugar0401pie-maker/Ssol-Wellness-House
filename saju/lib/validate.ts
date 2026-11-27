// 화면에서 보낸 값 검사(순수 함수 — validate.test.ts). 서버가 다시 확인한다(브라우저 검사만 믿지 않음).
import type { BirthInput } from "./types";
import { REGIONS } from "./regions.ts"; // .ts까지 적어야 node --test가 바로 읽는다

export const NICK_MAX = 10;
export const WORRY_MAX = 300;

export function cleanNickname(v: unknown): string | null {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  const n = [...s].length;
  return n >= 1 && n <= NICK_MAX ? s : null;
}

export function cleanWorry(v: unknown): string {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  return [...s].slice(0, WORRY_MAX).join("");
}

const CAL = ["양력", "음력", "음력(윤달)"] as const;
const GENDER = ["여성", "남성", "선택 안 함"] as const;
const SLOTS = ["오전(6~12시)", "오후(12~18시)", "저녁(18~22시)", "밤(22~6시)", "전혀 몰라요"];
const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : Number.NaN);

/** 생년월일 입력 검사. 1900~2013년생(만 14세 이상 확인은 화면 체크박스 + 여기서 연도로 한 번 더). */
export function cleanBirth(v: unknown, now = new Date()): BirthInput | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const calendar = CAL.find((c) => c === o.calendar);
  const gender = GENDER.find((g) => g === o.gender);
  const year = int(o.year), month = int(o.month), day = int(o.day);
  if (!calendar || !gender) return null;
  if (!(year >= 1900 && year <= now.getFullYear() - 14)) return null;
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= (calendar === "양력" ? new Date(year, month, 0).getDate() : 30))) return null;
  const timeKnown = o.timeKnown === true;
  const hour = timeKnown ? int(o.hour) : 0;
  const minute = timeKnown ? int(o.minute) : 0;
  if (timeKnown && !(hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59)) return null;
  const timeSlot = !timeKnown && typeof o.timeSlot === "string" && SLOTS.includes(o.timeSlot) ? o.timeSlot : null;
  const region = typeof o.region === "string" && REGIONS.some((r) => r.name === o.region) ? o.region : null;
  return { calendar, year, month, day, timeKnown, hour, minute, timeSlot, region, gender };
}

/** 다시 묻기 답: [{q, id}] 최대 2개(followup_questions.json max_questions). */
export function cleanAnswers(v: unknown): { q: string; id: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((a) => a && typeof a.q === "string" && typeof a.id === "string" && /^[\w-]{1,30}$/.test(a.q) && /^[\w-]{1,30}$/.test(a.id))
    .slice(0, 2)
    .map((a) => ({ q: a.q, id: a.id }));
}

/** 화면 이동용 next 값은 이 앱 안의 주소만(바깥 주소로 튕기는 것 막기). */
export function safeNext(v: unknown, fallback = "/"): string {
  return typeof v === "string" && /^\/(?!\/)[\w\-/?=&.%]*$/.test(v) ? v : fallback;
}
