import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { FollowupAnswer } from "ssol-saju-engine/followup";
import type { TestName } from "./tests";
import { longitudeOf } from "./regions";
import { priceAt, type PricingData } from "./pricing";
import type { BirthInput, SajuPage } from "./types";

// 사주 엔진(설계 패키지 원본)을 앱에 잇는 유일한 파일. 엔진 코드는 고치지 않는다 — 새 패키지가 오면 engine/을 통째로 바꾼다.
// 결과는 규칙 조립이라 AI 호출이 없다(설계 문서 6장). 생년월일은 AI·이벤트 로그에 넣지 않는다.

const DATA_DIR = path.join(process.cwd(), "engine", "02_데이터");
const CODE_DIR = path.join(process.cwd(), "engine", "03_코드");

// 엔진은 node:fs로 new URL("../02_데이터/…", import.meta.url)을 읽는다. 번들러가 엔진을 묶으면 이 경로가 깨져
// 개발 서버에서 500이 났다(serverExternalPackages로도 막히지 않음, 2026-11-27). 그래서 실행할 때 Node가 원본 파일을
// 그대로 불러오게 한다(turbopackIgnore). 배포 묶음에는 next.config.ts의 outputFileTracingIncludes로 들어간다.
type Engine = {
  report: typeof import("ssol-saju-engine/report");
  safety: typeof import("ssol-saju-engine/safety");
  followup: typeof import("ssol-saju-engine/followup");
  core: typeof import("ssol-saju-engine/core");
};
let enginePromise: Promise<Engine> | null = null;
const load = (file: string) => import(/* turbopackIgnore: true */ /* webpackIgnore: true */ pathToFileURL(path.join(CODE_DIR, file)).href);
export function engine(): Promise<Engine> {
  enginePromise ??= Promise.all([load("report.mjs"), load("safety.mjs"), load("followup.mjs"), load("core.mjs")]).then(
    ([report, safety, followup, core]) => ({ report, safety, followup, core }),
  );
  return enginePromise;
}
const cache = new Map<string, unknown>();

function readData<T>(file: string): T {
  if (!cache.has(file)) cache.set(file, JSON.parse(readFileSync(path.join(DATA_DIR, file), "utf8")));
  return cache.get(file) as T;
}

// 화면 문구는 ui_copy.json에서만(설계 문서 6장 "문구는 data에서만").
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UiCopy = Record<string, any>;
export const uiCopy = () => readData<UiCopy>("ui_copy.json");
export const priceNow = (now = new Date()) => priceAt(readData<PricingData>("pricing.json"), now);
export const feedManifest = (): Record<string, { file: string }[]> =>
  JSON.parse(readFileSync(path.join(process.cwd(), "public", "feed", "manifest.json"), "utf8"));

export { fill } from "./text";

const SLOT_OF: Record<string, "오전" | "오후" | "저녁" | "밤"> = {
  "오전(6~12시)": "오전",
  "오후(12~18시)": "오후",
  "저녁(18~22시)": "저녁",
  "밤(22~6시)": "밤",
};

/** 입력 화면 값 → 엔진 입력. 시간을 모르면 hour=null(엔진이 시주를 비움). */
export function engineInput(b: BirthInput) {
  return {
    year: b.year,
    month: b.month,
    day: b.day,
    hour: b.timeKnown ? b.hour : null,
    minute: b.timeKnown ? b.minute : 0,
    gender: b.gender === "여성" ? "female" : b.gender === "남성" ? "male" : null,
    isLunar: b.calendar !== "양력",
    isLeapMonth: b.calendar === "음력(윤달)",
    longitude: longitudeOf(b.region),
  };
}

/** 시간대만 아는 경우, 그 시간대에서 달라질 수 있는 살 안내 한 줄(core.timeCandidates). */
export async function timeNote(b: BirthInput): Promise<string> {
  const slot = SLOT_OF[b.timeSlot ?? ""];
  if (b.timeKnown || !slot) return "";
  try {
    return (await engine()).core.timeCandidates({ ...engineInput(b), minute: 0 }, slot).note;
  } catch {
    return "";
  }
}

/**
 * 고민 글 안전 확인 — 고민을 읽기 전에 가장 먼저(설계 문서 7-7). 위기(urgent)면 결과·결제로 넘어가지 않는다.
 * 안전 판단이 실패하면 더 조심스러운 쪽(위기 안내)으로 보낸다(fail safe).
 */
export async function screenWorry(text: string) {
  try {
    return (await engine()).safety.safetyCheck(text);
  } catch {
    return { level: "urgent" as const, stop: true, flagged: true };
  }
}

/** 짧은 고민이면 다시 묻기(설계 문서 7-10). answers가 있으면 다음 질문. */
export async function followup(text: string, test: TestName, nickname: string, answers: FollowupAnswer[] = []) {
  const { planFollowup, nextQuestion, FOLLOWUP } = (await engine()).followup;
  if (answers.length === 0) return planFollowup(text, test, FOLLOWUP, { name: nickname });
  const q = nextQuestion(FOLLOWUP, test, answers, text);
  return { ask: Boolean(q), read: null, intro: null, question: q };
}

export async function composeFollowup(text: string, answers: FollowupAnswer[]) {
  const { composeWorry, FOLLOWUP } = (await engine()).followup;
  return composeWorry(text, answers, FOLLOWUP);
}

/** 결과 만들기. 위기면 stop:true가 돌아온다(엔진이 결과를 만들지 않음). */
export async function buildResult(b: BirthInput, test: TestName, worry: string, nickname: string, today = new Date()): Promise<SajuPage> {
  return (await engine()).report.buildPage(engineInput(b), test, null, today.getMonth() + 1, worry, nickname, today) as SajuPage;
}
