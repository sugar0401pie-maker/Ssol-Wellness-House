// 2026-09-25: 새 9문항 온보딩(SSOL_Onboarding_Development_Spec_v1_0) 답변을, 기존
// getDailyPractice()가 쓰는 profiles.enjoyment_category/concern_domain(wellness_practices의
// category/domain 값)로 최대한 간단히 옮겨주는 다리. 스펙 6장의 정교한 하드 필터(375개
// 각각에 audience_tags 등을 부여)는 별도 작업으로 미뤄뒀고, 그때까지 기존 개인화가 완전히
// 죽지 않게 하는 임시 근사치일 뿐이다 — "완벽한 필터링"을 주장하지 않는다.

const HOBBY_TO_CATEGORY: Record<string, string> = {
  rest_home: "나를 돌보기",
  meet_friends: "관계·대화로 풀기",
  solo_running: "몸으로 움직이기",
  group_sports: "몸으로 움직이기",
  yoga_pilates: "몸으로 움직이기",
  reading_cafe: "나를 돌보기",
  creative: "나를 돌보기",
  culture: "나를 돌보기",
  learning: "생각 전환하기",
};

const FOCUS_DOMAIN_TO_DOMAIN: Record<string, string> = {
  self_emotions: "나 자신",
  human_relationships: "관계",
  romance: "연애",
  work_career: "커리어",
  parenting_care: "관계", // wellness_practices 재분류(20260924000400)와 동일하게 육아→관계
  life_direction: "삶의 방향",
  joy: "나 자신",
};

type RankedItem = { key: string; rank: number };

function topRankedKey(ranked: unknown): string | null {
  if (!Array.isArray(ranked) || ranked.length === 0) return null;
  const sorted = [...(ranked as RankedItem[])].sort((a, b) => a.rank - b.rank);
  return sorted[0]?.key ?? null;
}

export function deriveLegacyPreference(onboarding: {
  hobbies_ranked?: unknown;
  focus_domains?: unknown;
}): { enjoyment_category?: string; concern_domain?: string } | null {
  const result: { enjoyment_category?: string; concern_domain?: string } = {};

  const topHobby = topRankedKey(onboarding.hobbies_ranked);
  if (topHobby && HOBBY_TO_CATEGORY[topHobby]) result.enjoyment_category = HOBBY_TO_CATEGORY[topHobby];

  const focusDomains = Array.isArray(onboarding.focus_domains) ? (onboarding.focus_domains as string[]) : [];
  const topFocus = focusDomains.find((f) => FOCUS_DOMAIN_TO_DOMAIN[f]);
  if (topFocus) result.concern_domain = FOCUS_DOMAIN_TO_DOMAIN[topFocus];

  return Object.keys(result).length ? result : null;
}
