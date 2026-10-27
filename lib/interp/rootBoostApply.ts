// 해석된 뿌리로 실천 후보 순서를 조정하는 순수 부분(2026-10-18, 로드맵 6번).
// 점수에 더하기만 한다(필터가 아니라 순위 가산). 예외는 "맞지 않는 실천" 사전 제외(RC-15: 회피를 키우는 실천 등) 하나뿐이다.
// 가산 폭은 엔진 규칙대로 0~2 (확인된 뿌리 +2, 가능성 높은 뿌리 +1, 거절된 뿌리 0)이고, 주제 겹침 점수(문장 조각 개수)와 같은 눈금에서 가중치를 곱해 더한다.
export const ROOT_BOOST_WEIGHT = 2;

export type RootBoostFn = (practiceId: string, exposureStep?: number | null) => { boost: number; exclude: boolean };

export function applyRootBoost<T extends { id: string; score: number; exposureStep?: number | null }>(rows: T[], fn: RootBoostFn | null | undefined, weight = ROOT_BOOST_WEIGHT): T[] {
  if (!fn) return rows;
  const out: T[] = [];
  for (const r of rows) {
    const b = fn(r.id, r.exposureStep ?? null);
    if (b.exclude) continue;
    out.push(b.boost ? { ...r, score: r.score + b.boost * weight } : r);
  }
  return out.length ? out : rows; // 전부 제외되는 일은 드물지만, 그러면 가산 전 목록으로 되돌아간다(후보가 0개가 되지 않게)
}
