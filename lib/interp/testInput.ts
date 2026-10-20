// 심리테스트(디저트 v2) 결과 → 해석 엔진의 "테스트 단서" 입력으로 바꾸는 순수 함수(2026-10-18, 로드맵 7번).
// ssol_quiz_results는 다른 앱 소유라 읽기만 한다. 영역↔요인 표와 짝 뿌리는 CSO 규격(test_root_cues_v0.3.json)의 고정값이며
// 아직 DB 표(sw_ob_*)에 없어 여기에 둔다 — CSO가 DB 표로 옮기면 거기서 읽도록 바꾼다(요청 사항으로 전달).
export const TEST_DOMAINS: Record<string, string[]> = {
  CAR: ["job_fit", "meaning", "competence_cw"],
  LOV: ["partner_fit", "attachment", "tension_tol"],
  REL: ["boundary", "tension_tol", "approval_cw"],
  SLF: ["global_worth", "competence_cw", "approval_cw"],
  DIR: ["values", "meaning"],
};
export const TEST_PAIRS: [string, string][] = [["ROOT-77", "ROOT-81"], ["ROOT-41", "ROOT-58"], ["ROOT-72", "ROOT-47"]];

export type QuizRow = { id?: string | null; type_key?: string | null; factor_scores?: unknown; sub_scores?: unknown; created_at?: string | null };
export type TestInput = { test_id: string; factorScores: Record<string, number>; main_domain: string; coping: string; copingSub: Record<string, number>; at?: string };

const asObj = (v: unknown): Record<string, unknown> | null => {
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return null; } }
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
};
const nums = (o: Record<string, unknown> | null): Record<string, number> =>
  Object.fromEntries(Object.entries(o ?? {}).filter((e): e is [string, number] => typeof e[1] === "number" && Number.isFinite(e[1]) && e[1] >= 1 && e[1] <= 5));

// 요인 점수가 없으면 null(TRR-20: 단서를 만들지 않는다). type_key는 "CAR-primary" 꼴.
export function buildTestInput(row: QuizRow | null | undefined): TestInput | null {
  if (!row?.id) return null;
  const factorScores = nums(asObj(row.factor_scores));
  if (!Object.keys(factorScores).length) return null;
  const [main_domain, coping] = String(row.type_key ?? "").split("-");
  return { test_id: String(row.id), factorScores, main_domain: main_domain ?? "", coping: coping ?? "", copingSub: nums(asObj(row.sub_scores)), ...(row.created_at ? { at: row.created_at } : {}) };
}

type CueRow = { cue_id: string; source: string | null; cond_json: unknown; root_id: string | null; points: number | string | null; direction: string | null; entry_hyps: string | null };
// DB 행 → 엔진이 읽는 단서 모양. 조건이 깨졌거나 뿌리·점수가 없는 행은 건너뛴다.
export function buildCues(rows: CueRow[]) {
  return rows.flatMap((r) => {
    const cond = asObj(r.cond_json);
    const points = Number(r.points);
    if (!cond || !r.root_id || !Number.isFinite(points)) return [];
    return [{ cue_id: r.cue_id, source: r.source ?? "", cond, root_id: r.root_id, points, direction: r.direction ?? "cue", entry_hyps: (r.entry_hyps ?? "").split(",").map((x) => x.trim()).filter(Boolean) }];
  });
}
export const buildBands = (rows: { band: string; lo: number | string; hi: number | string; label?: string | null }[]): [string, number, number, string][] =>
  rows.map((b) => [b.band, Number(b.lo), Number(b.hi), b.label ?? ""] as [string, number, number, string]).sort((a, b) => a[1] - b[1]);
