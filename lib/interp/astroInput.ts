// 점성술 결과(astro_results, 점성술 앱 소유 — 읽기만) → 엔진 applyAstro가 읽는 handoff 모양(2026-10-20, 로드맵 7번 점성술 단서).
// 우리가 읽을 수 있는 것: 답 Q1~Q3(CSO 표의 답과 글자까지 같음), 유형(competency|style), 태양 별자리, 정확도(출생 시각 정확도 A/B/C).
// 읽을 수 없는 것(그쪽 표에 칸이 없음): 달·상승궁, 2026 주제, 올해의 주의 문구, 유형 카드를 직접 골랐는지(type_chosen) → 건너뛴다.
//   type_chosen을 모르면 유형 문장은 "자동 판정 성향 문장(F+, 뿌리당 최대 1.0)"으로만 읽는다(직접 고른 근거 D 2.0이 아님) — 더 조심스러운 쪽.
export type AstroRow = {
  id?: string | null; created_at?: string | null; answers?: unknown; competency?: string | null; style?: string | null; sun_sign?: string | null; accuracy?: string | null;
};
export type Handoff = {
  source_id: string; created_at: string;
  answers: { q1_domain?: string; q2_word_2026?: string; q3_wish_2027?: string };
  chart_summary: { sun?: string; type?: { competency: string; style: string } };
  user: { accuracy?: string };
  type_chosen: false;
};

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const asObj = (v: unknown): Record<string, unknown> => {
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return {}; } }
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
};

// id·시각이 없으면 근거를 만들지 않는다(재반영 때 이전 결과를 정확히 대체하려면 결과를 가리킬 수 있어야 함).
export function buildHandoff(row: AstroRow | null | undefined): Handoff | null {
  if (!row?.id || !row.created_at) return null;
  const a = asObj(row.answers);
  const answers = { q1_domain: str(a.q1), q2_word_2026: str(a.q2), q3_wish_2027: str(a.q3) };
  const competency = str(row.competency), style = str(row.style), sun = str(row.sun_sign);
  if (!answers.q1_domain && !answers.q2_word_2026 && !answers.q3_wish_2027 && !(competency && style) && !sun) return null;
  return {
    source_id: String(row.id), created_at: row.created_at, answers,
    chart_summary: { ...(sun ? { sun } : {}), ...(competency && style ? { type: { competency, style } } : {}) },
    user: { ...(str(row.accuracy) ? { accuracy: str(row.accuracy) } : {}) },
    type_chosen: false,
  };
}
