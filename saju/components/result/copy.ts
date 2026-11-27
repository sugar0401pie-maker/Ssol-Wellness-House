import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { priceAt, type PricingData } from "@/lib/pricing";

// 결과 화면 문구 중 ui_copy.json 밖에 있는 것.
// - front_text.json(1 · 2쪽 소제목 · 설명), challenge.json의 copy(작심삼일 챌린지 화면 문구): 엔진 데이터 파일에서 그대로 읽는다.
// - MOCK: 결과 화면 시안 v1.16.0(06_화면시안)에만 적혀 있고 데이터 파일에는 아직 없는 소제목 · 이름표. 시안 글자 그대로 옮김.
//   CSO가 ui_copy.json에 넣으면 이 표를 지우고 그쪽에서 읽는다.

const DATA_DIR = path.join(process.cwd(), "engine", "02_데이터");
const cache = new Map<string, unknown>();
function readData<T>(file: string): T {
  if (!cache.has(file)) cache.set(file, JSON.parse(readFileSync(path.join(DATA_DIR, file), "utf8")));
  return cache.get(file) as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
// 결과 화면은 엔진 코드(ssol-saju-engine)를 부르지 않는다 — 저장된 결과만 그린다. 그래서 lib/engine.ts 대신
// 같은 데이터 파일을 여기서 직접 읽는다(lib/engine.ts를 가져오면 엔진 모듈까지 묶여서 dev에서 깨짐: 보고 참고).
export type UiCopy = Json;
export const uiCopy = () => readData<UiCopy>("ui_copy.json");
export const priceNow = (now = new Date()) => priceAt(readData<PricingData>("pricing.json"), now);
export const feedManifest = (): Record<string, { file: string }[]> =>
  JSON.parse(readFileSync(path.join(process.cwd(), "public", "feed", "manifest.json"), "utf8"));
export const frontText = () => readData<Json>("front_text.json");
export const challengeCopy = () => (readData<Json>("challenge.json").copy ?? {}) as Json;

export const MOCK = {
  pillarLabels: ["연주(해)", "월주(달)", "일주(날)", "시주(시)"],
  salIntroLink: "살이 뭐예요?",
  summaryLabel: "한눈에 보기",
  worryLabel: "고민 맞춤",
  financeMark: "ⓘ ",
  // 7쪽 이하 '강점을 살리는 방식'(p7)
  total: {
    areas: { 연애: "연애", 직장: "일", 재물: "돈", 관계: "관계" } as Record<string, string>,
    partner: "도움이 되는 사람:",
    place: "만나기 쉬운 곳:",
    care: "조심할 것:",
    field: "잘 맞는 분야:",
    save: "모으는 법:",
  },
  career: {
    h1: "① 내 일의 본질 — 말, 머리, 발, 손",
    th: ["일의 방식", "맞는 정도"],
    best: "이 가장 잘 맞아요.",
    h3: "③ 지치기 쉬운 일",
  },
  love: {
    h1: "① 마음을 주고받는 방식",
    h2: "② 맞지 않기 쉬운 관계",
    h3: "③ 나에게 도움이 되는 사람 (서로 채워 주는 사람)",
    th: ["나의 특징", "도움이 되는 사람"],
    h4: "④ 만나기 쉬운 곳",
  },
  money: {
    h1: "① 돈이 들어오는 방식",
    th: ["방식", "맞는 정도", "이유"],
    h2: "② 돈이 새는 곳",
    h3: "③ 부수입이 생기기 쉬운 쪽 (대표 살 밖의 살)",
    h4: "④ 모으는 법",
  },
  // '언제 움직일까'(p8)
  halvesH: "상반기와 하반기",
  monthlyH: "달마다 한눈에",
  careerAvoidH: "서명, 입사일을 잡지 않는 편이 좋은 달",
  careerRecogH: "인정받기 좋은 달",
  loveRows: [
    ["meet", "새 사람을 만나기 좋은 달"],
    ["progress", "관계가 가까워지기 좋은 달"],
    ["approach", "먼저 다가가기 좋은 달"],
    ["conflict", "서운함이나 다툼이 생기기 쉬운 달"],
  ] as [string, string][],
  moneyRows: [
    ["inflow", "돈이 들어오기 좋은 달"],
    ["avoid", "큰 지출, 계약을 미룰 달"],
    ["contract", "계약, 이사를 정하기 좋은 달"],
  ] as [string, string][],
  choiceNote: "이 흐름은 {nickname}님의 선택에 따라 얼마든지 달라질 수 있어요.",
  // '움직이는 날짜와 이유'(p8b)
  careerEarlyH: "상반기에 옮기고 싶다면",
  totalAreasH: "영역별로 움직이기 좋은 달",
  // 활용법(p9) · 쏘웰라(p10)
  challengeAlt: "쏠 작심삼일 챌린지",
  challengeImg: "/banner/03-three-day-challenge-1200x400.webp",
  dayBadge: "{n}일차",
  glossOpen: "눌러서 펼치기",
  sowellaName: "쏘웰라",
  lanternAlt: "2027 소원 담아 풍등 날리기",
  lanternImg: "/banner/02-wish-lantern-1200x400.webp",
};
