// 사용자 대화와 비슷한 이론 질문들(검색 결과)을 이론 단위로 묶어 "어느 이론이 가장 가까운지"
// 판단하는 순수 함수. 네트워크 없이 테스트할 수 있다(matcher.test.ts).
//
// 채택 규칙(모두 만족해야 후보가 된다 — 아니면 null, 즉 평소 대화 그대로):
//  1) 그 이론에서 걸린 질문이 minHits개 이상
//  2) 점수(상위 topPerTheory개 유사도의 평균)가 minScore 이상
//  3) 2등 이론과의 점수 차이가 margin 이상 — 이론들이 비슷한 질문을 갖고 있을 때("겹치는 질문")
//     어느 쪽인지 애매하면 억지로 고르지 않는다.
// minScore/margin 값은 감으로 정한 임시값이다. 실제 대화 로그로 보정해야 한다(설계안 6장).

export type TheoryHit = {
  questionId: string;
  theoryId: string;
  similarity: number;
};

export type MatcherConfig = {
  minScore: number;
  margin: number;
  minHits: number;
  topPerTheory: number;
};

export const DEFAULT_MATCHER_CONFIG: MatcherConfig = {
  minScore: 0.45,
  margin: 0.03,
  minHits: 2,
  topPerTheory: 3,
};

export type TheoryCandidate = {
  theoryId: string;
  score: number;
  hitQuestionIds: string[]; // 점수가 높은 순
};

export function pickTheoryCandidate(hits: TheoryHit[], cfg: MatcherConfig = DEFAULT_MATCHER_CONFIG): TheoryCandidate | null {
  const byTheory = new Map<string, TheoryHit[]>();
  for (const h of hits) {
    if (!Number.isFinite(h.similarity)) continue;
    const list = byTheory.get(h.theoryId) ?? [];
    list.push(h);
    byTheory.set(h.theoryId, list);
  }

  const scored: TheoryCandidate[] = [];
  for (const [theoryId, list] of byTheory) {
    if (list.length < cfg.minHits) continue;
    const sorted = [...list].sort((a, b) => b.similarity - a.similarity);
    const top = sorted.slice(0, cfg.topPerTheory);
    const score = top.reduce((sum, h) => sum + h.similarity, 0) / top.length;
    scored.push({ theoryId, score, hitQuestionIds: sorted.map((h) => h.questionId) });
  }
  if (!scored.length) return null;

  scored.sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  if (best.score < cfg.minScore) return null;
  if (second && best.score - second.score < cfg.margin) return null;
  return best;
}
