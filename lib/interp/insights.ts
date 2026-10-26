// 마이페이지 "쏘웰라가 파악한 내용" — 어떤 뿌리를 보여 줄지 고르는 순수 함수(2026-10-18, 로드맵 10번).
// 보여 주는 것: 대화에서 짐작해 본 마음(DB의 사용자용 문장 report). 거절된 것·민감 표시 뿌리·점수가 낮은 것·문장이 없는 것은 보여 주지 않는다.
// 진단·성격 라벨처럼 읽히지 않게 이름 대신 "~일 수 있어요" 문장만 쓰고, 맞다/아니다/지우기를 사용자가 정한다(AI는 제안자).
import type { RootText, StateLite } from "./speak";

export const INSIGHT_MIN_SCORE = 1.0; // 대화에서 비친 적이 있는 뿌리의 최소 점수
export const INSIGHT_MIN_SCORE_ANSWERS = 2.0; // 대화 근거 없이 테스트·온보딩 답만으로 보여 줄 때의 최소 점수(온보딩이 한 사람당 20개 넘는 약한 단서를 만들어 목록이 짐작으로 가득 차는 것을 막음)
export const INSIGHT_MAX_ITEMS = 6;

export type InsightStatus = "confirmed" | "guess";
export type Insight = { rootId: string; status: InsightStatus; text: string; strength: string; from: "chat" | "answers" }; // from: 대화에서 비친 적이 있으면 chat, 테스트·온보딩에서 고른 답만이면 answers

const RANK: Record<string, number> = { confirmed: 2, likely: 1, candidate: 0 };

export function buildInsights(states: StateLite[], texts: Record<string, RootText>): Insight[] {
  return states
    .filter((s) => (s.status === "confirmed" || s.score >= ((s.sources ?? []).includes("chat") ? INSIGHT_MIN_SCORE : INSIGHT_MIN_SCORE_ANSWERS)) && s.status in RANK)
    .filter((s) => {
      const t = texts[s.root_id];
      return !!t && !t.sensitive && t.report.trim().length > 0;
    })
    .sort((a, b) => RANK[b.status] - RANK[a.status] || b.score - a.score || a.root_id.localeCompare(b.root_id))
    .slice(0, INSIGHT_MAX_ITEMS)
    .map((s) => ({ rootId: s.root_id, status: s.status === "confirmed" ? "confirmed" : "guess", text: texts[s.root_id].report, strength: texts[s.root_id].strength, from: (s.sources ?? []).includes("chat") ? "chat" : "answers" }));
}

export type InsightAction = "confirm" | "reject" | "remove";
export const isInsightAction = (v: unknown): v is InsightAction => v === "confirm" || v === "reject" || v === "remove";
export const isRootId = (v: unknown): v is string => typeof v === "string" && /^ROOT-[A-Za-z0-9-]{1,12}$/.test(v);
