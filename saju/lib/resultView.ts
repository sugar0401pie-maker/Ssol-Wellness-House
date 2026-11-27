// 결과 화면(/result/{id}/{쪽})의 순수 도우미. 서버 전용 데이터(엔진 · 파일)를 읽지 않는다 — 테스트: resultView.test.ts

/** 쪽 순서(ui_copy.layout.order_by_test[테스트])에서 쪽 번호(1부터)의 key. 없으면 null. */
export function keyAt(order: readonly string[], n: number): string | null {
  if (!Number.isInteger(n) || n < 1 || n > order.length) return null;
  return order[n - 1];
}

/** "/result/{id}/{n}"의 n 문자열 → 숫자(정수만). */
export function parsePageNo(s: string): number | null {
  return /^[1-9][0-9]?$/.test(s) ? Number(s) : null;
}

/** 대표 살 주소 /sal/1 · 2 · 3 → 쪽 key. */
export const SAL_ROUTE_KEYS = ["p4", "sal2", "sal3"] as const;

// paywall.decision_when: "5쪽 답 형식이 선택형·시기형·가능성형이면 _decision"
const DECISION_TYPES = ["선택형", "시기형", "가능성형"];
/** page.route.answer("선택형: …")가 결정형이면 true. */
export function isDecisionAnswer(answer: unknown): boolean {
  if (typeof answer !== "string") return false;
  const head = answer.split(":")[0].trim();
  return DECISION_TYPES.includes(head);
}

// ---- 결정적 난수(결과 번호로 씨앗) ----
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(list: readonly T[], seed: number): T[] {
  const r = rng(seed);
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 쪽마다 피드 그림 1장(ui_copy.feed): 결과 번호로 섞은 순서대로, 한 리포트 안에서 겹치지 않게.
 * 다 쓰면 다시 섞어서 이어 간다(바로 앞 그림과 같은 그림으로 시작하지 않게).
 * 돌려주는 값: key → 파일 이름(skip 쪽은 없음).
 */
export function pickFeed(order: readonly string[], files: readonly string[], id: string, skip: readonly string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  if (files.length === 0) return out;
  const pages = order.filter((k) => !skip.includes(k));
  let round = 0;
  let deck = seededShuffle(files, hashString(id));
  let i = 0;
  for (const k of pages) {
    if (i >= deck.length) {
      round++;
      const last = deck[deck.length - 1];
      deck = seededShuffle(files, hashString(`${id}#${round}`));
      if (deck.length > 1 && deck[0] === last) [deck[0], deck[1]] = [deck[1], deck[0]];
      i = 0;
    }
    out[k] = deck[i++];
  }
  return out;
}

// ---- 한국어 조사 ----
export function hasBatchim(word: string): boolean {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;
  return code % 28 !== 0;
}

const JOSA: Record<string, [string, string]> = {
  이에요: ["이에요", "예요"],
  이: ["이", "가"],
  을: ["을", "를"],
  은: ["은", "는"],
  과: ["과", "와"],
};

/** "{sal:이에요}" 같은 조사 자리 채우기. 조사 표시가 없는 자리는 그대로 둔다(fill이 채움). */
export function fillJosa(text: string, vars: Record<string, string>): string {
  return String(text ?? "").replace(/\{(\w+):([^}]+)\}/g, (m, k: string, j: string) => {
    if (!(k in vars)) return m;
    const pair = JOSA[j];
    if (!pair) return vars[k] + j;
    return vars[k] + (hasBatchim(vars[k]) ? pair[0] : pair[1]);
  });
}

/** 살 이름 → '○○살'(귀인 · 정록은 그대로). 엔진 report.salKo와 같은 규칙. */
export const salKo = (n: string) => (/살$|귀인$/.test(n) || n === "정록" ? n : n + "살");

// ---- 굵은 글씨(**…**) ----
export type Seg = { text: string; bold: boolean };
/** "**굵게** 보통" → 조각들. 짝이 맞지 않는 **는 글자 그대로 둔다. */
export function splitBold(text: string): Seg[] {
  const s = String(text ?? "");
  const parts = s.split("**");
  if (parts.length % 2 === 0) return [{ text: s, bold: false }];
  return parts.map((t, i) => ({ text: t, bold: i % 2 === 1 })).filter((p) => p.text !== "");
}

/** 첫 문장을 굵게(ui_copy.style.bold — 두괄식). 이미 굵은 글씨가 있으면 그대로. */
export function boldFirstSentence(text: string): string {
  const s = String(text ?? "");
  if (s.includes("**") || !s.trim()) return s;
  const m = s.match(/^(.+?[.!?])(\s+)([\s\S]*)$/);
  if (!m) return `**${s}**`;
  return `**${m[1]}**${m[2]}${m[3]}`;
}

/** n번째 문장(0부터)을 굵게. */
export function boldSentenceAt(text: string, idx: number): string {
  const s = String(text ?? "");
  if (s.includes("**")) return s;
  const parts = s.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g);
  if (!parts || idx >= parts.length) return s;
  return parts.map((p, i) => (i === idx ? `**${p.trim()}**${p.match(/\s*$/)?.[0] ?? ""}` : p)).join("");
}

/** 문장 끝에 마침표가 없으면 붙인다. */
export const endDot = (s: string) => (/[.!?)]$/.test(String(s ?? "").trim()) ? String(s).trim() : `${String(s ?? "").trim()}.`);

/** 맞는 정도 점(●●●○○). */
export const dots = (n: number, max = 5) => "●".repeat(Math.max(0, Math.min(max, n))) + "○".repeat(Math.max(0, max - Math.max(0, Math.min(max, n))));

/** 달 목록 → "3월, 12월". */
export const monthsText = (ms: readonly number[]) => ms.map((m) => `${m}월`).join(", ");

// ---- 네 기둥 글자(한글 → 한자 · 오행). 명리의 고정 표 ----
export const STEM: Record<string, [string, string]> = {
  갑: ["甲", "목"], 을: ["乙", "목"], 병: ["丙", "화"], 정: ["丁", "화"], 무: ["戊", "토"],
  기: ["己", "토"], 경: ["庚", "금"], 신: ["辛", "금"], 임: ["壬", "수"], 계: ["癸", "수"],
};
export const BRANCH: Record<string, [string, string]> = {
  자: ["子", "수"], 축: ["丑", "토"], 인: ["寅", "목"], 묘: ["卯", "목"], 진: ["辰", "토"], 사: ["巳", "화"],
  오: ["午", "화"], 미: ["未", "토"], 신: ["申", "금"], 유: ["酉", "금"], 술: ["戌", "토"], 해: ["亥", "수"],
};
/** "신축" → "辛丑" (간지 두 글자). */
export function ganjiHanja(ko: string): string {
  const [s, b] = [...String(ko ?? "")];
  return `${STEM[s]?.[0] ?? s ?? ""}${BRANCH[b]?.[0] ?? b ?? ""}`;
}

/** 달력 판정(calendar[].grade) → 칸 class. */
export const gradeClass = (g: string) => (g === "good" ? "good" : g === "caution" || g === "bad" ? "bad" : "mid");

/** 결과 번호로 고르는 하나(쏘웰라 대화의 이용자 말풍선 등). */
export function pickBySeed<T>(list: readonly T[], seed: string): T | undefined {
  if (list.length === 0) return undefined;
  return list[hashString(seed) % list.length];
}
