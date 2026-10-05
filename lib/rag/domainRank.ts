// 실천방법의 "영역 순위" 계산 — 순수 함수라 네트워크 없이 테스트할 수 있다(domainRank.test.ts).
//
// 2026-10-06 owner 결정(B-라이트): wellness_practices.domain은 그대로 "1순위 영역"이고,
// secondary_domains(순서 있는 목록)가 "2순위·3순위…" 영역이다. 예: "이 일이 나에게 어떤 의미인지
// 확인하기"는 1순위 커리어, 2순위 삶의 방향. 이 값은 "이 실천이 어느 주제 영역인가"의 분류일 뿐이고,
// 온보딩 답에 맞춰 점수를 매기는 개인화 태그(q7_focus_codes 등)와는 일부러 분리해 둔다 —
// 한쪽(온보딩 문항·AI 초안 태그)이 바뀌어도 다른 쪽이 같이 흔들리지 않게.

export type DomainLike = { domain: string; secondaryDomains?: string[] };

// 1순위 일치 / 2순위 일치 / 3순위 이하 일치 가산점. 실제 대화 로그를 보며 조정할 값(임시).
export const DOMAIN_RANK_SCORES = [5, 3, 2] as const;

export function domainRankScore(p: DomainLike, target: string | null | undefined): number {
  if (!target) return 0;
  if (p.domain === target) return DOMAIN_RANK_SCORES[0];
  const i = (p.secondaryDomains ?? []).indexOf(target);
  if (i < 0) return 0;
  // 목록의 첫 값이 2순위이므로 점수표는 한 칸 뒤에서 시작한다. 3순위보다 뒤는 마지막 점수를 그대로 쓴다.
  return DOMAIN_RANK_SCORES[Math.min(i + 1, DOMAIN_RANK_SCORES.length - 1)];
}

// 홈 "오늘의 실천"의 후보 풀 좁히기: 1순위 영역 → 2순위 영역 → 전체 순으로 넓혀 간다.
// 2순위 항목은 1순위 후보가 하나도 없을 때(예: 삶의 방향)에만 쓴다 — 다른 영역을 고른 분의
// 추천에 2순위 항목이 섞이지 않게 해서, 이 변경 전의 동작을 그대로 유지한다.
export function pickDailyPool<T extends DomainLike & { category: string }>(
  pool: T[],
  pref: { category?: string | null; domain?: string | null },
): T[] {
  const { category, domain } = pref;
  if (!domain) return pool;
  const primary = pool.filter((p) => p.domain === domain);
  const secondary = pool.filter((p) => p.domain !== domain && (p.secondaryDomains ?? []).includes(domain));
  const sameCategory = (p: T) => p.category === category;
  const steps = category
    ? [primary.filter(sameCategory), primary, secondary.filter(sameCategory), secondary]
    : [primary, secondary];
  return steps.find((s) => s.length > 0) ?? pool;
}
