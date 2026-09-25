import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { passesHardFilter, scoreSoftPreference, type OnboardingPrefs, type PracticeEligibility } from "@/lib/onboarding/practiceFilter";

// wellness_practices(owner가 만든 실천방법 DB, 375개: domain x category x tier)에서 지금
// 대화 상황에 맞을 만한 몇 개를 골라 답변 재료로 준다. 진단이나 처방이 아니라 "지금 해볼 수
// 있는 것"을 구체적으로 제안할 때(자기돌봄, 3턴 이후 요약·제안 등) 참고 자료로만 쓰인다.
// 375행뿐이라 serviceSearch.ts와 같은 이유로 별도 임베딩 없이 글자 bigram 겹침을 쓰고,
// 대화에서 짐작되는 삶의 영역(domain) 일치에 가산점을 준다.
//
// 2026-09-25: SSOL_375_Practice_Onboarding_Project_v1.md 반영 + owner 추가 요청("양육·파트너
// 등 온보딩에서 확인 안 된 건 원칙적으로 제시하지 않기") — practice_eligibility의 하드 필터
// (파트너 없는데 커플 활동, 육아 중이 아닌데 육아 활동 등 추천 금지)는 온보딩 여부·동의 여부와
// 무관하게 **항상** 적용한다. 온보딩을 안 했거나 개인화 동의를 안 한 사용자는 모든 값이
// null/빈 배열인 채로 필터를 통과해야 하므로, 파트너·육아·업무를 전제하는 항목은 자동으로
// 걸러지고 일반(SELF류) 제안만 남는다 — "확인 안 됐으면 안전한 쪽"이라 이게 맞는 동작이다.
// 실제 값(Q4~Q7 취향 순위 등)을 써서 더 세밀하게 추천하는 건 개인화 동의를 한 사용자만 받는다.

export type PracticeResult = {
  id: string;
  domain: string;
  category: string;
  tier: string;
  title: string;
  detail: string;
};

let cache: { rows: PracticeResult[]; loadedAt: number } | null = null;
let eligibilityCache: { map: Map<string, PracticeEligibility>; loadedAt: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

async function loadPractices(): Promise<PracticeResult[]> {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache.rows;
  const admin = createAdminClient();
  const { data, error } = await admin.from("wellness_practices").select("id,domain,category,tier,title,detail");
  if (error) {
    console.error("wellness_practices 조회 실패:", error.message);
    return cache?.rows ?? [];
  }
  cache = { rows: data ?? [], loadedAt: Date.now() };
  return cache.rows;
}

async function loadEligibilityMap(): Promise<Map<string, PracticeEligibility>> {
  if (eligibilityCache && Date.now() - eligibilityCache.loadedAt < TTL_MS) return eligibilityCache.map;
  const admin = createAdminClient();
  const { data, error } = await admin.from("practice_eligibility").select("*");
  if (error) {
    // 마이그레이션을 아직 안 돌렸어도(테이블 없음) 조용히 빈 맵으로 — 필터가 그냥 안 걸릴 뿐이다.
    return eligibilityCache?.map ?? new Map();
  }
  const map = new Map<string, PracticeEligibility>();
  for (const row of data ?? []) {
    map.set(row.practice_id, {
      practiceId: row.practice_id,
      audienceMode: row.audience_mode,
      requiresPartner: row.requires_partner,
      requiresChildcare: row.requires_childcare,
      requiresWork: row.requires_work,
      requiresOtherPerson: row.requires_other_person,
      workContext: row.work_context,
      q4ValueCodes: row.q4_value_codes ?? [],
      q5HobbyCodes: row.q5_hobby_codes ?? [],
      q6WeekendCodes: row.q6_weekend_codes ?? [],
      q7FocusCodes: row.q7_focus_codes ?? [],
      q9ExclusionCodes: row.q9_exclusion_codes ?? [],
      reviewStatus: row.review_status,
    });
  }
  eligibilityCache = { map, loadedAt: Date.now() };
  return map;
}

// 적격성 데이터가 아직 없는(마이그레이션 전이거나, 375건 중 드물게 매핑이 안 된) 항목은
// 제한 없이 통과시킨다 — "확인 안 된 건 걸지 않는다" 원칙과 같은 이유로, 데이터 부재를
// 차단 사유로 쓰지 않는다.
function filterByEligibility<T extends { id: string }>(
  items: T[],
  eligibilityMap: Map<string, PracticeEligibility>,
  prefs: OnboardingPrefs,
): T[] {
  return items.filter((item) => {
    const e = eligibilityMap.get(item.id);
    if (!e) return true;
    return passesHardFilter(e, prefs);
  });
}

function bigrams(text: string): Set<string> {
  const clean = text.replace(/\s+/g, "");
  const set = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2));
  return set;
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

// 메시지에서 삶의 영역을 아주 단순한 키워드로 짐작한다. 안전 판단이나 검색 하드 필터가 아니라
// 순위 가산점일 뿐이라 틀려도 큰 문제는 없다 — 아무것도 안 걸리면 "나 자신"(범용 자기돌봄)으로 둔다.
// 2026-09-24: 심리테스트 v2의 5개 영역(커리어/연애/관계/나 자신/삶의 방향)과 이름을 맞췄다
// (wellness_practices.domain도 migration 20260924000400로 같이 재분류함). 육아 관련
// 키워드는 이제 "관계"로 합쳐진다(v2의 "관계" 영역이 가족을 포함).
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  연애: ["남편", "아내", "와이프", "남자친구", "여자친구", "애인", "연인", "배우자"],
  커리어: ["회사", "직장", "상사", "팀장", "동료", "업무", "이직", "퇴사", "커리어", "야근", "면접"],
  관계: ["아이", "아기", "육아", "자녀", "아들", "딸", "친구", "인간관계", "지인", "동창", "선후배", "모임", "가족", "부모님"],
};

function guessDomain(text: string): string {
  for (const [domain, words] of Object.entries(DOMAIN_KEYWORDS)) {
    if (words.some((w) => text.includes(w))) return domain;
  }
  return "나 자신";
}

function stripScore(p: PracticeResult & { score: number }): PracticeResult {
  return { id: p.id, domain: p.domain, category: p.category, tier: p.tier, title: p.title, detail: p.detail };
}

export async function searchWellnessPractices(
  message: string,
  recentMessages: { role: "user" | "assistant"; content: string }[],
  onboardingPrefs: OnboardingPrefs,
): Promise<PracticeResult[]> {
  let rows = await loadPractices();
  if (!rows.length) return [];

  {
    const eligibilityMap = await loadEligibilityMap();
    const filtered = filterByEligibility(rows, eligibilityMap, onboardingPrefs);
    if (filtered.length) rows = filtered; // 다 걸러져 후보가 0개면(드묾) 안전하게 필터 전 목록으로 되돌아간다
  }

  const contextText = [...recentMessages.slice(-4).map((m) => m.content), message].join(" ");
  const qBigrams = bigrams(contextText);
  const domain = guessDomain(contextText);

  const scored = rows.map((p) => ({
    ...p,
    score: overlapScore(qBigrams, bigrams(`${p.title} ${p.detail} ${p.category}`)) + (p.domain === domain ? 5 : 0),
  }));

  // 2026-09-22 결정: "단기(가볍게 시작)와 중장기(꾸준히 이어가기·장기 습관)를 섞어서 ~3개
  // 제안"하려면 후보 자체에 tier 다양성이 있어야 한다. 순수 점수 정렬만 하면 "가볍게 시작"
  // 항목(도메인당 25개)이 상위권을 독식해서 중장기 항목이 후보에 아예 안 들어올 수 있다 —
  // 그래서 tier별로 나눠 뽑는다: 단기 2개 + 중장기(꾸준히 이어가기/장기 습관) 각 1개.
  const byTier = (tier: string) => scored.filter((p) => p.tier === tier).sort((a, b) => b.score - a.score);

  const picked = [
    ...byTier("가볍게 시작").slice(0, 2),
    ...byTier("꾸준히 이어가기").slice(0, 1),
    ...byTier("장기 습관·정체성으로").slice(0, 1),
  ];

  return picked.map(stripScore);
}

// 문자열을 32비트 정수로 접는 아주 단순한 해시(FNV-1a류). 암호화 목적이 아니라 "날짜+사용자
// 마다 항상 같은 항목이 나오게" 결정론적으로 고르는 용도일 뿐이다.
function simpleHash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 홈 탭의 "오늘의 실천방법" — 하루·사용자 조합마다 항상 같은 항목이 나오도록 날짜+userId를
// 시드로 결정론적으로 고른다(매번 새로고침해도 같은 날엔 같은 제안). "가볍게 시작" 난이도만
// 후보로 써서 부담 없이 오늘 바로 해볼 수 있는 것 위주로 제안한다.
// 2026-09-24: 심리테스트 v2 개편 이후 이 표의 domain(커리어/연애/관계/나 자신/삶의 방향)이
// 심리테스트의 5개 영역과 이름이 같아졌다(위 recategorize 마이그레이션 참고) — 다만 실제
// 개인화는 온보딩 답변(아래)으로 하고, 심리테스트 결과 자체를 진단처럼 연결하지는 않는다(SAFE-005).
// 온보딩 답변(즐거움 카테고리·고민 도메인)이 있으면 그 조합으로 후보를 좁힌다
// ("육아와 무관한데 육아 조언이 나온다"는 피드백 반영). 정확히 맞는 조합이 없거나 아직
// 온보딩을 안 한 사용자는 이전처럼 전체 "가볍게 시작" 목록에서 고른다(완전히 막히지 않도록
// domain만 맞는 것 → 전체 순으로 점점 넓혀가는 fallback).
// 2026-09-25: 관계/육아/업무 하드 필터는 항상 먼저 적용한다(위 설명 참고). 개인화 동의까지
// 한 사용자(hasConsentedData)는 그 안에서 Q4~Q7 선호 점수가 가장 높은 후보 중 하나를 날짜로
// 결정론적으로 고르고, 그렇지 않으면 기존 category/domain 매칭(둘 다 하드 필터를 통과한
// 후보 안에서만) → 전체 하드 필터 통과 후보 순으로 넓혀간다.
export async function getDailyPractice(
  userId: string,
  dateKey: string,
  preference: { category?: string | null; domain?: string | null } | undefined,
  onboardingPrefs: OnboardingPrefs,
  hasConsentedData: boolean,
): Promise<PracticeResult | null> {
  const rows = await loadPractices();
  const base = rows.filter((p) => p.tier === "가볍게 시작");
  if (!base.length) return null;

  const eligibilityMap = await loadEligibilityMap();
  const hardFiltered = filterByEligibility(base, eligibilityMap, onboardingPrefs);
  // 극단적 예외(하드 필터로 전부 걸러짐, 사실상 안 일어남)에만 안전하게 전체 목록으로 돌아간다.
  const pool0 = hardFiltered.length ? hardFiltered : base;

  if (hasConsentedData) {
    const scored = pool0.map((p) => {
      const e = eligibilityMap.get(p.id);
      return { ...p, score: e ? scoreSoftPreference(e, onboardingPrefs) : 0 };
    });
    const topScore = Math.max(...scored.map((p) => p.score));
    // 가장 선호 점수가 높은 후보들끼리만 날짜로 고른다(항상 1등만 나오면 매일 똑같아 보이므로,
    // 동점자 사이에서는 날짜에 따라 자연스럽게 바뀐다).
    const topPool = scored.filter((p) => p.score === topScore);
    const idx = simpleHash(`${dateKey}:${userId}`) % topPool.length;
    return topPool[idx];
  }

  const { category, domain } = preference ?? {};
  const bothMatch = category && domain ? pool0.filter((p) => p.category === category && p.domain === domain) : [];
  const domainOnly = domain ? pool0.filter((p) => p.domain === domain) : [];
  const pool = bothMatch.length ? bothMatch : domainOnly.length ? domainOnly : pool0;

  const idx = simpleHash(`${dateKey}:${userId}`) % pool.length;
  return pool[idx];
}
