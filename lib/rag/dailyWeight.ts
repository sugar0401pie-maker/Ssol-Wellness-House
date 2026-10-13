// 홈 "오늘의 실천" 후보에서 이론 기반 실천(source_theory_id가 있는 것)의 비중을 올린다(2026-10-13 owner: "이론 실천 비중은 높아지면 좋긴 하지").
// 후보 하나를 날짜·사용자로 고르는 방식(practicesSearch.getDailyPractice)은 그대로 두고, 이론 기반 실천을 weight번 넣어 뽑힐 확률만 키운다.
// 필터(온보딩 하드 필터·노출 제한·위기 이력)는 이 함수 앞에서 이미 적용되므로 가중치가 안전 규칙을 우회할 수 없다. weight=1이면 이전과 같다.
// 후보가 이론 기반뿐이거나 일반뿐이면 비율이 바뀌지 않는다(그 경우 그대로 고른다).
export const DEFAULT_THEORY_WEIGHT = 2; // 가볍게 시작 후보 기준 약 39% → 약 56%

export function parseTheoryWeight(raw: string | undefined, fallback = DEFAULT_THEORY_WEIGHT): number {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n)) return fallback;
  return Math.min(5, Math.max(1, Math.round(n))); // 1~5배로 제한(너무 크면 일반 실천이 사실상 사라진다)
}

export function weightTheoryPractices<T extends { sourceTheoryId: string | null }>(pool: T[], weight: number): T[] {
  const w = Math.max(1, Math.floor(weight));
  if (w <= 1) return pool;
  return pool.flatMap((p) => (p.sourceTheoryId ? Array.from({ length: w }, () => p) : [p]));
}
