import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { emptyPrefs, type OnboardingPrefs, type RankedAnswer } from "./practiceFilter";

export type OnboardingPrefsResult = {
  prefs: OnboardingPrefs;
  // 실제 온보딩 데이터로 소프트 취향 점수(Q4~Q7)를 매길 수 있는지. 온보딩을 안 했거나
  // 개인화 동의를 안 한 사용자는 항상 emptyPrefs()라 하드 필터(파트너/육아/업무)는 그대로
  // 다 걸리고(=파트너·육아 전제 제안이 안 나감, 2026-09-25 owner 요청), 소프트 랭킹만 빠진다.
  hasConsentedData: boolean;
};

function toRankedArray(v: unknown): RankedAnswer[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (x): x is RankedAnswer => !!x && typeof x === "object" && typeof x.key === "string" && typeof x.rank === "number",
  );
}

// user_onboarding(9문항 온보딩)에서 실천방법 필터링에 필요한 값만 뽑아온다.
//
// 2026-09-25 owner 요청("양육이나 파트너처럼 온보딩에서 선택하지 않은 건 원칙적으로 제시
// 안 하도록"): 온보딩을 아직 안 했거나 개인화 동의를 안 한 사용자도 emptyPrefs()(전부 null/빈
// 배열)를 받는다 — null은 "해당 없음"으로 취급돼 파트너/육아/업무 전제 제안이 하드 필터에서
// 자동으로 걸러지므로, 이 경우 안전하게 일반(SELF류) 제안만 남는다. 실제 값은 동의한
// 사용자에게만 채워서, 그 값이 있어야만 파트너/육아 전제 제안이 열린다.
export async function loadOnboardingPrefs(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<OnboardingPrefsResult> {
  const { data } = await admin
    .from("user_onboarding")
    .select(
      "relationship_status, childcare_status, primary_activity, values_ranked, hobbies_ranked, weekends_ranked, focus_domains, excluded_activities, personalization_consent",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || !data.personalization_consent) return { prefs: emptyPrefs(), hasConsentedData: false };

  return {
    prefs: {
      relationshipStatus: data.relationship_status,
      childcareStatus: data.childcare_status,
      primaryActivity: data.primary_activity,
      valuesRanked: toRankedArray(data.values_ranked),
      hobbiesRanked: toRankedArray(data.hobbies_ranked),
      weekendsRanked: toRankedArray(data.weekends_ranked),
      focusDomains: Array.isArray(data.focus_domains) ? data.focus_domains : [],
      excludedActivities: Array.isArray(data.excluded_activities) ? data.excluded_activities : [],
    },
    hasConsentedData: true,
  };
}
