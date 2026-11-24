// 마이페이지 "쏘웰라가 파악한 내용" — 어떤 뿌리를 보여 줄지 고르는 순수 함수(2026-10-18, 로드맵 10번).
// 보여 주는 것: 대화에서 짐작해 본 마음(DB의 사용자용 문장 report). 거절된 것·민감 표시 뿌리·점수가 낮은 것·문장이 없는 것은 보여 주지 않는다.
// 진단·성격 라벨처럼 읽히지 않게 이름 대신 "~일 수 있어요" 문장만 쓴다(AI는 제안자). 2026-11-24부터 화면에는 지우기만(맞아요/아니에요 버튼 없음).
import type { RootText, StateLite } from "./speak";

export const INSIGHT_MIN_SCORE = 1.0; // 대화에서 비친 적이 있는 뿌리의 최소 점수
export const INSIGHT_MIN_SCORE_ANSWERS = 2.0; // 대화 근거 없이 테스트·온보딩 답만으로 보여 줄 때의 최소 점수(온보딩이 한 사람당 20개 넘는 약한 단서를 만들어 목록이 짐작으로 가득 차는 것을 막음)
export const INSIGHT_MAX_ITEMS = 6;

export type InsightStatus = "confirmed" | "guess";
export type Insight = { rootId: string; status: InsightStatus; text: string; strength: string; from: "chat" | "answers"; directionLine?: string; lastTalkAt?: string | null }; // directionLine: 그 마음을 "알아차리고 쓰는 쪽"으로 가고 있을 때·아직 끌려갈 때의 한 줄(CSO DIR-05, 내부 값 이름은 사용자에게 보이지 않음) // from: 대화에서 비친 적이 있으면 chat, 테스트·온보딩에서 고른 답만이면 answers

const RANK: Record<string, number> = { confirmed: 2, likely: 1, candidate: 0 };

// 2026-11-24: 대화(채팅·과제 확인 답)에서 그 마음이 마지막으로 비친 때 — 지워지거나 바로잡힌 근거·0점 근거는 뺀다.
const TALK_SOURCES = new Set(["chat", "task"]);
type LedgerLite = { source?: string; at?: string | null; validity?: string; points?: number };
export function lastTalkAt(s: StateLite & { ledger?: LedgerLite[] }): string | null {
  let best: string | null = null;
  for (const e of s.ledger ?? []) {
    if (!TALK_SOURCES.has(String(e.source)) || (e.validity && e.validity !== "active") || !e.points || !e.at) continue;
    if (!best || e.at > best) best = e.at;
  }
  return best;
}

function eligible(states: StateLite[], texts: Record<string, RootText>) {
  return states
    .filter((s) => (s.status === "confirmed" || s.score >= ((s.sources ?? []).includes("chat") ? INSIGHT_MIN_SCORE : INSIGHT_MIN_SCORE_ANSWERS)) && s.status in RANK)
    .filter((s) => {
      const t = texts[s.root_id];
      return !!t && !t.sensitive && t.report.trim().length > 0;
    });
}
const toInsight = (s: StateLite, texts: Record<string, RootText>): Insight => ({
  rootId: s.root_id, status: s.status === "confirmed" ? "confirmed" : "guess", text: texts[s.root_id].report, strength: texts[s.root_id].strength,
  from: (s.sources ?? []).includes("chat") ? "chat" : "answers", lastTalkAt: lastTalkAt(s),
});

export function buildInsights(states: StateLite[], texts: Record<string, RootText>, limit = INSIGHT_MAX_ITEMS): Insight[] {
  return eligible(states, texts)
    .sort((a, b) => RANK[b.status] - RANK[a.status] || b.score - a.score || a.root_id.localeCompare(b.root_id))
    .slice(0, limit)
    .map((s) => toInsight(s, texts));
}

// 2026-11-24 대표님 요청: 마이페이지 맨 위에 "가장 최근 대화 기준" 한 개 — 대화에서 가장 최근에 비친 마음(같은 때면 점수가 높은 쪽).
// 대화에서 비친 것이 하나도 없으면 null(테스트·온보딩 답만으로는 "최근 대화"가 아니므로 보여 주지 않는다).
export function latestTalkInsight(states: StateLite[], texts: Record<string, RootText>): Insight | null {
  const withTalk = eligible(states, texts).map((s) => ({ s, at: lastTalkAt(s) })).filter((x): x is { s: StateLite; at: string } => !!x.at);
  if (!withTalk.length) return null;
  withTalk.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : b.s.score - a.s.score));
  return toInsight(withTalk[0].s, texts);
}

// "당신에 대한 해석" 화면 묶음(2026-11-24): 맞다고 하신 마음 → 이야기에서 자주 비친 마음 → 고르신 답에서 보인 마음. 빈 묶음은 뺀다.
export type InsightGroup = { key: "confirmed" | "chat" | "answers"; title: string; items: Insight[] };
export function groupInsights(items: Insight[]): InsightGroup[] {
  const g: InsightGroup[] = [
    { key: "confirmed", title: "맞다고 하신 마음", items: items.filter((i) => i.status === "confirmed") },
    { key: "chat", title: "이야기 속에서 자주 비친 마음", items: items.filter((i) => i.status !== "confirmed" && i.from === "chat") },
    { key: "answers", title: "고르신 답(테스트·온보딩·점성술)에서 보인 마음", items: items.filter((i) => i.status !== "confirmed" && i.from === "answers") },
  ];
  return g.filter((x) => x.items.length > 0);
}

// 첫 문장(마침표·물음표·느낌표로 끝나는 첫 부분)과 나머지 — 화면에서 첫 문장을 굵게(대표님 2026-11-24).
export function splitFirstSentence(text: string): [string, string] {
  const m = /^(.+?[.?!])(\s+)([\s\S]+)$/.exec(text.trim());
  return m ? [m[1], m[3]] : [text.trim(), ""];
}

export type InsightAction = "confirm" | "reject" | "remove";
export const isInsightAction = (v: unknown): v is InsightAction => v === "confirm" || v === "reject" || v === "remove";
export const isRootId = (v: unknown): v is string => typeof v === "string" && /^ROOT-[A-Za-z0-9-]{1,12}$/.test(v);

// "○○님과의 대화에서 읽은 것들" 화면(2026-11-24 대표님 요청): 묶음으로 나누지 않고 문단(글머리표)을 줄글로 잇는다.
// 한 번에 최대 3문단(PAGE_SIZE), "더 알고 싶어요"를 누르면 다음 3문단(끝나면 처음으로). 앞 한 줄은 한 화면의 첫 문단에만 —
// 첫 화면은 "○○님은 이런 마음이 보여요.", 다음 화면부터는 "○○님은 이런 모습도 있어요."(대표님: 문단마다 반복되면 지루함).
// 순서는 buildInsights 그대로(맞다고 하신 것 → 점수 순). 요즘의 변화가 있으면 맨 끝 문단(자기 앞 한 줄을 가짐).
export const INTERP_PAGE_SIZE = 3;
export type InterpParagraph = { lead: string; text: string | null; extras: string[] };
export function interpretationPages(items: Insight[], growth: string[], name: string | null | undefined, size = INTERP_PAGE_SIZE): InterpParagraph[][] {
  const n = name?.trim();
  const who = n ? `${n}님은 ` : "";
  const paras: InterpParagraph[] = items.map((it) => ({ lead: "", text: it.text, extras: [it.strength, it.directionLine].filter((x): x is string => !!x && x.trim().length > 0) }));
  const g = growth.filter((x) => x.trim());
  if (g.length) paras.push({ lead: `${n ? `${n}님에게 ` : ""}요즘 이런 변화도 보여요.`, text: null, extras: g });
  const pages: InterpParagraph[][] = [];
  for (let i = 0; i < paras.length; i += size) {
    const page = paras.slice(i, i + size).map((p) => ({ ...p }));
    if (page[0].text !== null) page[0].lead = `${who}${i === 0 ? "이런 마음이 보여요." : "이런 모습도 있어요."}`;
    pages.push(page);
  }
  return pages;
}
