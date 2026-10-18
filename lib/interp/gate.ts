// 해석 기능을 켤 대상·경로를 정하는 순수 함수(2026-10-18). 기본은 꺼짐이다.
// SW_INTERP_ENABLED=1 이어야 하고, 대상은 SW_INTERP_ALLOWLIST(쉼표로 구분한 사용자 id 또는 이메일, "*"는 전체)에 있어야 한다.
// 약관·방침 개정 시행일 전에는 대표·테스트 계정만 넣고, 시행일에 "*"로 바꾼다.
export type Allowlist = { all: boolean; ids: Set<string>; emails: Set<string> };

export function parseAllowlist(raw: string | undefined | null): Allowlist {
  const out: Allowlist = { all: false, ids: new Set(), emails: new Set() };
  for (const part of (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    if (part === "*") out.all = true;
    else if (part.includes("@")) out.emails.add(part.toLowerCase());
    else out.ids.add(part.toLowerCase());
  }
  return out;
}

export function isInterpEnabled(env: { SW_INTERP_ENABLED?: string; SW_INTERP_ALLOWLIST?: string }, userId: string, email?: string | null): boolean {
  if (env.SW_INTERP_ENABLED !== "1") return false;
  const a = parseAllowlist(env.SW_INTERP_ALLOWLIST);
  if (a.all) return true;
  if (a.ids.has(userId.toLowerCase())) return true;
  return !!email && a.emails.has(email.toLowerCase());
}

// 이 대화 경로에서만 분석한다. 위기·폭력은 앞 단계에서 끝나므로 여기 오지 않고, 진단·약물 질문과 서비스 문의도 제외한다.
export function interpRoutes(raw: string | undefined | null): Set<string> {
  const list = (raw ?? "wellness,life_decision,clinical_distress").split(",").map((s) => s.trim()).filter(Boolean);
  return new Set(list);
}

export const MIN_CHARS = 6; // 너무 짧은 말("네", "그래요")은 분석하지 않는다(비용 절약)
export function shouldAnalyze(route: string, text: string, routes: Set<string>): boolean {
  return routes.has(route) && text.replace(/\s/g, "").length >= MIN_CHARS;
}
