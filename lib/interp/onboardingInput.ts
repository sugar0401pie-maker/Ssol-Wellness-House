// 온보딩 답(우리 user_onboarding 행) → CSO 온보딩 채점 코드가 읽는 모양으로 바꾸는 순수 함수(2026-10-20, 로드맵 7번 온보딩 단서).
// 결정(대표님 2026-10-20): 화면 코드는 우리 것이 기준이다. CSO 조건이 쓰는 코드와 다른 몇 개는 여기서 CSO 코드로 바꿔 읽고,
// 대응이 없는 값은 버린다(그 값을 쓰는 조건은 맞지 않을 뿐 오류는 나지 않는다 — 모르는 값은 "맞다고 보지 않음").
export type RankedRaw = { key?: unknown; rank?: unknown };
export type OnboardingRow = {
  relationship_status?: string | null; dating_interest?: string | null; relationship_stage?: string | null; childcare_status?: string | null;
  child_age_groups?: string[] | null; primary_activity?: string | null; values_ranked?: unknown; hobbies_ranked?: unknown; weekends_ranked?: unknown;
  focus_domains?: string[] | null; daily_time?: string[] | null; excluded_activities?: string[] | null; completed_at?: string | null; updated_at?: string | null;
};
export type EngineAnswer = { value: string | string[]; answered_at: string };
export type EngineAnswers = Record<string, EngineAnswer>;

// 우리 코드 → CSO 코드. 값이 null이면 대응 없음(버림).
export const CODE_MAP: Record<string, Record<string, string | null>> = {
  relationship_stage: { dating_no_marriage_plan: "dating", preparing_marriage_or_cohabitation: "engaged", cohabiting: "cohabiting", married: "married" },
  child_age_groups: { age_0_2: "infant", age_3_6: "preschool", age_7_12: "elementary", age_13_18: "teen", adult_child: null },
  daily_time: { under_5: "under_5", min_10_15: "min_10_15", min_20_30: null, flexible: null, varies: null }, // CSO의 min_30·over_60은 "임시" 코드라 우리 값과 같은 뜻으로 보지 않는다
  dating_interest: { unsure: null },
};
const mapCodes = (q: string, v: string[]): string[] => v.map((x) => (q in CODE_MAP && x in CODE_MAP[q] ? CODE_MAP[q][x] : x)).filter((x): x is string => !!x);

export function rankedKeys(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return (v as RankedRaw[])
    .filter((x): x is { key: string; rank: number } => !!x && typeof x.key === "string" && typeof x.rank === "number")
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.key);
}

export function mapOnboardingAnswers(row: OnboardingRow, fallbackAt = new Date().toISOString()): EngineAnswers {
  const at = row.completed_at ?? row.updated_at ?? fallbackAt;
  const out: EngineAnswers = {};
  const put = (q: string, v: string | string[] | null | undefined) => {
    const val = Array.isArray(v) ? mapCodes(q, v) : v ? (mapCodes(q, [v])[0] ?? null) : null;
    if (val === null || (Array.isArray(val) && !val.length)) return;
    out[q] = { value: val, answered_at: at };
  };
  put("values_ranked", rankedKeys(row.values_ranked));
  put("hobbies_ranked", rankedKeys(row.hobbies_ranked));
  put("weekends_ranked", rankedKeys(row.weekends_ranked));
  put("focus_domains", row.focus_domains ?? []);
  for (const q of ["relationship_status", "dating_interest", "relationship_stage", "childcare_status", "primary_activity"] as const) put(q, row[q]);
  put("child_age_groups", row.child_age_groups ?? []);
  put("daily_time", row.daily_time ?? []);
  put("excluded_activities", row.excluded_activities ?? []);
  return out;
}

// 개인화 동의를 하고 온보딩을 끝낸 사용자만 근거로 쓴다(실천 추천의 개인화 기준과 같음). 아니면 빈 목록 → 이미 있던 온보딩 근거는 정정 처리된다.
export const onboardingEligible = (row: { status?: string | null; personalization_consent?: boolean | null } | null | undefined): boolean =>
  !!row && row.status === "completed" && row.personalization_consent === true;
