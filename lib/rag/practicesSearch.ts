import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { domainRankScore, pickDailyPool } from "@/lib/rag/domainRank";
import { passesHardFilter, scoreSoftPreference, type OnboardingPrefs, type PracticeEligibility } from "@/lib/onboarding/practiceFilter";
import { passesServingRules, type ServingContext } from "@/lib/onboarding/servingRules";
import { STABILIZATION_PRACTICE_IDS, type TraumaStage } from "@/lib/safety/traumaStage";

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

// 내부용 행: 화면·프롬프트로 나가는 PracticeResult에 "2순위 이하 영역"(순위 계산용)과 노출 제한 칸(이론 기반 실천용)을 더한 것.
type PracticeRow = PracticeResult & {
  secondaryDomains: string[];
  availability: string | null;
  exposureFlag: boolean | null;
  exposureStep: number | null;
  sourceTheoryId: string | null;
  suggestReason: string | null;
};

function toResult(p: PracticeResult): PracticeResult {
  return { id: p.id, domain: p.domain, category: p.category, tier: p.tier, title: p.title, detail: p.detail };
}

let cache: { rows: PracticeRow[]; loadedAt: number } | null = null;
let eligibilityCache: { map: Map<string, PracticeEligibility>; loadedAt: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

async function loadPractices(): Promise<PracticeRow[]> {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache.rows;
  const admin = createAdminClient();
  const base = "id,domain,category,tier,title,detail";
  // 칸을 새로 추가한 마이그레이션(2순위 영역 20261006000000, 이론 실천 노출 제한 20261006000200)을 아직 안 돌렸어도
  // 실천방법 제안 전체가 사라지지 않게, 새 칸이 있는 조회부터 시도하고 실패하면 칸을 줄여 다시 읽는다.
  const attempts = [`${base},secondary_domains,availability,exposure_flag,exposure_step,source_theory_id,suggest_reason`, `${base},secondary_domains`, base];
  let res = await admin.from("wellness_practices").select(attempts[0]);
  for (let i = 1; res.error && i < attempts.length; i++) res = await admin.from("wellness_practices").select(attempts[i]);
  const { data, error } = res;
  if (error) {
    console.error("wellness_practices 조회 실패:", error.message);
    return cache?.rows ?? [];
  }
  const rows: PracticeRow[] = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    domain: r.domain as string,
    category: r.category as string,
    tier: r.tier as string,
    title: r.title as string,
    detail: r.detail as string,
    secondaryDomains: ((r.secondary_domains as string[] | null | undefined) ?? []) as string[],
    availability: (r.availability as string | null | undefined) ?? null,
    exposureFlag: (r.exposure_flag as boolean | null | undefined) ?? null,
    exposureStep: (r.exposure_step as number | null | undefined) ?? null,
    sourceTheoryId: (r.source_theory_id as string | null | undefined) ?? null,
    suggestReason: (r.suggest_reason as string | null | undefined) ?? null,
  }));
  cache = { rows, loadedAt: Date.now() };
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
// (wellness_practices.domain도 migration 20260924000400로 같이 재분류함).
// 2026-10-05 owner 결정: 육아는 "관계"에 합치지 않고 다시 "육아" 영역으로 분리했다
// (migration 20261005000200). 객체 순서대로 먼저 걸리는 영역이 이기므로 "육아"를 "관계"보다 앞에 둔다.
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  연애: ["남편", "아내", "와이프", "남자친구", "여자친구", "애인", "연인", "배우자"],
  커리어: ["회사", "직장", "상사", "팀장", "동료", "업무", "이직", "퇴사", "커리어", "야근", "면접"],
  육아: ["아이", "아기", "육아", "자녀", "아들", "딸"],
  관계: ["친구", "인간관계", "지인", "동창", "선후배", "모임", "가족", "부모님"],
  // 2026-10-06: '삶의 방향'은 가장 일반적인 단어들이라 맨 뒤에 둔다(앞 영역 키워드가 먼저 이긴다).
  // 순위 가산점일 뿐이라 빗나가도 큰 문제는 없지만, 흔한 단어("꿈이" 등)는 일부러 뺐다.
  "삶의 방향": ["삶의 방향", "인생", "진로", "뭘 해야 할지", "뭘 하고 싶", "하고 싶은 게", "꿈이 없", "가치관", "살아가는 의미"],
};

function guessDomain(text: string): string {
  for (const [domain, words] of Object.entries(DOMAIN_KEYWORDS)) {
    if (words.some((w) => text.includes(w))) return domain;
  }
  return "나 자신";
}

function stripScore(p: PracticeResult & { score: number }): PracticeResult {
  return toResult(p);
}

export async function searchWellnessPractices(
  message: string,
  recentMessages: { role: "user" | "assistant"; content: string }[],
  onboardingPrefs: OnboardingPrefs,
  serving: ServingContext,
  traumaStage: TraumaStage | null = null,
): Promise<PracticeResult[]> {
  // 이론 기반 실천 노출 제한(after_explore·exposure·위기 이력) — 트라우마 대화(T0/T1)에서는 exposure를 전부 뺀다.
  const ctx: ServingContext = traumaStage ? { ...serving, excludeExposure: true } : serving;
  let rows = (await loadPractices()).filter((p) => passesServingRules(p, ctx));
  if (!rows.length) return [];

  // 트라우마 T1(지금 압도): 탐색·일반 제안을 멈추고 안정화 실천 1~2개만 후보로 준다(문서 4-6-1). 아직 데이터에 없으면 아래 일반 검색으로.
  const stabilization = STABILIZATION_PRACTICE_IDS.map((id) => rows.find((p) => p.id === id)).filter((p): p is PracticeRow => !!p);
  if (traumaStage === "T1" && stabilization.length) return stabilization.slice(0, 2).map(toResult);

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
    score: overlapScore(qBigrams, bigrams(`${p.title} ${p.detail} ${p.category}`)) + domainRankScore(p, domain),
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

  // 트라우마 T0(일상어): 안정화 실천을 추천 앞쪽에 둔다(문서 4-6-1). 이미 뽑힌 항목과 겹치면 중복 없이.
  if (traumaStage === "T0" && stabilization.length) {
    const front = stabilization.slice(0, 2).map(toResult);
    const rest = picked.map(stripScore).filter((p) => !front.some((f) => f.id === p.id));
    return [...front, ...rest];
  }

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
  serving: ServingContext,
): Promise<PracticeResult | null> {
  const rows = await loadPractices();
  // 이론 기반 실천 노출 제한: 홈에서도 after_explore는 안 나가고, exposure는 위기 이력 계정에 안 나간다(1단계만).
  const base = rows.filter((p) => p.tier === "가볍게 시작" && passesServingRules(p, serving));
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
    return toResult(topPool[idx]);
  }

  // 2026-10-06: 1순위 영역 → 2순위 영역(secondary_domains) → 전체 순으로 넓힌다(lib/rag/domainRank.ts).
  // 1순위 후보가 있는 영역은 예전과 똑같이 동작하고, 1순위 후보가 0개인 "삶의 방향"만 2순위 항목을 쓴다.
  const pool = pickDailyPool(pool0, preference ?? {});

  const idx = simpleHash(`${dateKey}:${userId}`) % pool.length;
  return toResult(pool[idx]);
}


export type CommitPractice = { id: string; title: string; detail: string; reason: string | null };

// 이론 탐색을 마무리(COMMIT)할 때 권할 실천 1~2개(문서 4-2 ⑤·4-11): 그 이론과 "궁합이 맞는(fit)" 연결 실천과 그 이론에서 나온 실천을 후보로,
// 궁합이 충돌(conflict)하는 것은 뺀다. 온보딩 하드 필터(파트너·돌봄·재직·제외)와 노출 제한(위기 이력 등)은 항상 먼저 적용하고,
// 탐색을 거친 대화이므로 이 이론의 after_explore 실천은 허용한다(allowAfterExplore). 단기(가볍게 시작) 하나 + 이어가기 하나를 우선한다.
// 후보가 하나도 없으면 빈 배열(호출하는 쪽이 일반 검색으로 대체).
export async function pickCommitPractices(params: {
  theoryId: string;
  messages: string[]; // 최근 사용자 발화(관련도 가산점용)
  onboardingPrefs: OnboardingPrefs;
  serving: ServingContext;
  traumaStage: TraumaStage | null;
  alreadyShownText?: string; // 이 대화에서 이미 나간 답변 글(같은 실천을 또 권하지 않으려고 제목이 들어 있는지 본다)
}): Promise<CommitPractice[]> {
  const admin = createAdminClient();
  const [{ data: links }, rowsAll] = await Promise.all([
    admin.from("theory_practice_links").select("practice_id, compatibility").eq("theory_id", params.theoryId),
    loadPractices(),
  ]);
  const fit = new Set<string>(), conflict = new Set<string>();
  for (const l of (links ?? []) as { practice_id: string; compatibility: string }[]) (l.compatibility === "conflict" ? conflict : l.compatibility === "fit" ? fit : new Set<string>()).add(l.practice_id);

  const ctx: ServingContext = { ...params.serving, allowAfterExplore: true, excludeExposure: params.traumaStage != null || params.serving.excludeExposure };
  const shown = params.alreadyShownText ?? "";
  let rows = rowsAll.filter((p) => !conflict.has(p.id) && passesServingRules(p, ctx) && !(shown && shown.includes(p.title)));
  const eligibilityMap = await loadEligibilityMap();
  rows = filterByEligibility(rows, eligibilityMap, params.onboardingPrefs);
  const q = bigrams(params.messages.slice(-3).join(" "));
  const candidates = rows
    .filter((p) => fit.has(p.id) || p.sourceTheoryId === params.theoryId)
    .map((p) => ({ p, score: (fit.has(p.id) ? 3 : 0) + (p.sourceTheoryId === params.theoryId ? 2 : 0) + Math.min(overlapScore(q, bigrams(`${p.title} ${p.detail}`)), 6) * 0.4 })) // 주제 관련도(최대 2.4점)는 이론 적합(3점)·출처(2점)를 뒤집지 못하지만, 같은 적합도끼리는 대화 주제에 가까운 것을 앞세운다
    .sort((a, b) => b.score - a.score);
  const short = candidates.find((c) => c.p.tier === "가볍게 시작");
  const longer = candidates.find((c) => c.p.tier !== "가볍게 시작" && c !== short);
  const picked = [short, longer].filter((c): c is NonNullable<typeof c> => !!c);
  for (const c of candidates) { if (picked.length >= 2) break; if (!picked.includes(c)) picked.push(c); }
  return picked.slice(0, 2).map(({ p }) => ({ id: p.id, title: p.title, detail: p.detail, reason: p.suggestReason }));
}
