// 해석 기능을 켤 대상·경로를 정하는 순수 함수(2026-10-18).
// owner 결정(2026-10-18, 사용자가 거의 없어 환경 변수를 따로 넣지 않기로 함): **기본은 전체 켜짐**이다.
//   - 끄기(킬 스위치): SW_INTERP_ENABLED=0
//   - 일부에게만: SW_INTERP_ALLOWLIST에 쉼표로 구분한 사용자 id 또는 이메일을 넣는다("*"는 전체). 목록이 비어 있거나 없으면 전체.
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
  if (env.SW_INTERP_ENABLED === "0") return false;
  const a = parseAllowlist(env.SW_INTERP_ALLOWLIST);
  if (a.all || (a.ids.size === 0 && a.emails.size === 0)) return true; // 목록이 없으면 전체
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
