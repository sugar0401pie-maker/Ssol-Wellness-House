// 2026-09-25: SSOL_375_Practice_Onboarding_Project_v1.md 5장의 하드 필터/소프트 점수 로직을
// 그대로 옮긴 순수 함수. 네트워크 없이 테스트할 수 있게 practicesSearch.ts에서 분리했다.
// 문서의 "미확정 조항"(coworker_context 확인, 검증 안 된 시간 강제 적용)은 그대로 두지 않고
// 문서가 명시한 대로 "확인 안 되면 걸지 않는다" 쪽으로 안전하게 구현한다.

export type PracticeEligibility = {
  practiceId: string;
  audienceMode: string;
  requiresPartner: boolean;
  requiresChildcare: boolean;
  requiresWork: boolean;
  requiresOtherPerson: boolean;
  workContext: "none" | "working_any" | "coworker_environment";
  q4ValueCodes: string[];
  q5HobbyCodes: string[];
  q6WeekendCodes: string[];
  q7FocusCodes: string[];
  q9ExclusionCodes: string[];
  reviewStatus: string;
};

export type RankedAnswer = { key: string; rank: number };

export type OnboardingPrefs = {
  relationshipStatus: string | null;
  childcareStatus: string | null;
  primaryActivity: string | null;
  valuesRanked: RankedAnswer[];
  hobbiesRanked: RankedAnswer[];
  weekendsRanked: RankedAnswer[];
  focusDomains: string[];
  excludedActivities: string[];
};

const WORK_ACTIVITIES = new Set(["full_time", "part_time", "freelance"]);
const CHILDCARE_ACTIVE = new Set(["raising_child", "regular_caregiver"]);

// 사람 검토를 아직 못 받은 13건(NEEDS_TITLE_AND_HUMAN_REVIEW)은 안전하게 후보에서 뺀다 —
// "확인 안 된 건 걸지 않는다"는 프로젝트 문서 6장 원칙을 따른다.
export function isApprovedForServing(e: Pick<PracticeEligibility, "reviewStatus">): boolean {
  return e.reviewStatus !== "NEEDS_TITLE_AND_HUMAN_REVIEW";
}

// 문서 5장 하드 필터 그대로: 관계/육아/업무 적격성 + Q9 하드 제외.
// work_context="coworker_environment"는 "동료 환경 확인" 같은 추가 질문이 온보딩에 아직 없어서
// (문서의 "미확정 조항"), 확인할 방법이 없는 지금은 일반 근무자 조건(WORK_ACTIVITIES)으로만
// 판단하고 더 엄격하게 걸지 않는다 — 나중에 그 확인 질문이 추가되면 여기를 강화하면 된다.
export function passesHardFilter(e: PracticeEligibility, prefs: OnboardingPrefs): boolean {
  if (!isApprovedForServing(e)) return false;

  if (e.requiresPartner && prefs.relationshipStatus !== "has_partner") return false;

  if (e.requiresChildcare && !CHILDCARE_ACTIVE.has(prefs.childcareStatus ?? "")) return false;

  if (e.requiresWork && !WORK_ACTIVITIES.has(prefs.primaryActivity ?? "")) return false;

  if (e.requiresOtherPerson && prefs.excludedActivities.includes("other_people")) return false;

  if (e.q9ExclusionCodes.some((code) => prefs.excludedActivities.includes(code))) return false;

  return true;
}

function scoreRanked(codes: string[], ranked: RankedAnswer[]): number {
  if (!codes.length || !ranked.length) return 0;
  const rankPoints: Record<number, number> = { 1: 3, 2: 2, 3: 1 };
  let score = 0;
  for (const r of ranked) {
    if (codes.includes(r.key)) score += rankPoints[r.rank] ?? 0;
  }
  return score;
}

// 문서 5장 소프트 점수: Q4/5/6 순위(1·2·3 -> 3·2·1점) + Q7 포함 여부.
export function scoreSoftPreference(e: PracticeEligibility, prefs: OnboardingPrefs): number {
  let score = 0;
  score += scoreRanked(e.q4ValueCodes, prefs.valuesRanked);
  score += scoreRanked(e.q5HobbyCodes, prefs.hobbiesRanked);
  score += scoreRanked(e.q6WeekendCodes, prefs.weekendsRanked);
  if (e.q7FocusCodes.some((c) => prefs.focusDomains.includes(c))) score += 1;
  return score;
}

export function emptyPrefs(): OnboardingPrefs {
  return {
    relationshipStatus: null,
    childcareStatus: null,
    primaryActivity: null,
    valuesRanked: [],
    hobbiesRanked: [],
    weekendsRanked: [],
    focusDomains: [],
    excludedActivities: [],
  };
}
