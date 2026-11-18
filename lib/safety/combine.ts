// route.ts의 "판정 합치기" 로직을 네트워크 호출 없이 테스트할 수 있도록 분리한 순수 함수들.
import type { KeywordHit } from "./keywordCheck.ts";
import type { ClassifierResult } from "./classify.ts";
import type { ResponseRoute } from "./rules.ts";
import { ROUTES, moreSevere, routeOrder, type RouteDecision, type RouteId } from "./types.ts";
import { screenExplicit } from "./explicit.ts";
import type { KeywordHit as Hit } from "./keywordCheck.ts";

// ───── 2026-11-18 CSO 결정(개발 요청 v1.3 §2): 위기·폭력 경로는 이용자 글에 "직접" 쓰인 표현이 있을 때만 ─────
// AI 분류기만 위기·폭력으로 본 판단은 위기 안내 대상이 아니다(31건 중 AI 단독 20건, 맞은 것 4건). 그런 말은 평소 대화로 가되 "힘든 메시지"로 센다.
const DANGER = new Set<RouteId>(["crisis", "violence"]);
const isDanger = (r: RouteId) => DANGER.has(r);

// 직접 표현 판정. 위기·폭력·듣기(watch)면 분류기를 부르지 않고 바로 결정한다(AI 장애와 무관하게 동작 — CLAUDE.md §5).
// 아무것도 아니면 null → 분류기로 넘어간다.
export function explicitDecision(message: string, hits: Hit[]): RouteDecision | null {
  const ex = screenExplicit(message);
  const strong = hits.filter((h) => !h.weak);
  const overdose = strong.some((h) => h.ruleId === "SAFE-021");
  const certainty = strong.some((h) => h.ruleId === "SAFE-020");
  // 폭력: 직접 표현 판정 + 코드 패턴 V1·V2(supplemental — ruleId SAFE-001, trigger가 실제 문구) + DB 키워드 SAFE-001(협박·스토킹 같은 구체 낱말).
  const violenceHit = strong.some((h) => h.route === "violence");
  const codes: string[] = [];
  let route: RouteId | null = null;
  if (overdose) { route = "crisis"; codes.push("S7-a"); }
  if (ex.level === "urgent") { route = "crisis"; codes.push("S1-b"); }
  if (certainty) { route = "crisis"; codes.push("S1-b"); }
  if (ex.violence === "physical" || (violenceHit && ex.violence !== "control")) { route = route ?? "violence"; codes.push("V1"); }
  else if (ex.violence === "control") { route = route ?? "violence"; codes.push("V3"); }
  if (route) {
    return { route, matchedRuleIds: Array.from(new Set(strong.filter((h) => h.route === route).map((h) => h.ruleId))), source: "keyword", confidence: "high", classifierUnavailable: false, safetyCodes: Array.from(new Set(codes)) };
  }
  // 듣기(watch): 사라지고 싶다·살 이유가 없다 같은 소극적 표현 — 위기 경로가 아니라 공감하고 듣기. 기록상 경로는 clinical_distress.
  if (ex.level === "watch") {
    return { route: "clinical_distress", matchedRuleIds: [], source: "keyword", confidence: "high", classifierUnavailable: false, safetyCodes: ["S1-a"] };
  }
  return null;
}

// 키워드 매치만으로 즉시 확정된 경우 (분류기를 부르지 않음).
export function decisionFromInstantHit(hit: KeywordHit, allHits: KeywordHit[]): RouteDecision {
  const sameRouteRuleIds = Array.from(new Set(allHits.filter((h) => h.route === hit.route).map((h) => h.ruleId)));
  return {
    route: hit.route,
    matchedRuleIds: sameRouteRuleIds,
    source: "keyword",
    confidence: "high",
    classifierUnavailable: false,
  };
}

// 분류기 호출 자체가 실패했을 때 (OpenAI 장애 등). 내용을 지어내지 않는다.
export function decisionOnClassifierFailure(hits: KeywordHit[], errorMessage: string): RouteDecision {
  // 2026-11-18: 위기·폭력은 직접 표현 판정(explicitDecision)이 먼저 처리한다 — 여기까지 온 위기·폭력 낱말은 직접 표현이 아니므로 쓰지 않는다.
  const usable = hits.filter((h) => !isDanger(h.route));
  const candidate = usable.length
    ? usable.reduce((best, h) => (routeOrder(h.route) < routeOrder(best.route) ? h : best))
    : null;
  return {
    route: candidate?.route ?? "wellness",
    matchedRuleIds: candidate ? [candidate.ruleId] : [],
    source: "keyword",
    confidence: "low",
    classifierUnavailable: true,
    reasoning: `분류기 호출 실패: ${errorMessage}`,
  };
}

// 분류기 결과 + 키워드 후보를 합쳐 최종 route를 정한다. (핵심 규칙: 항상 더 위험한 쪽)
export function combineWithClassifier(
  hits: KeywordHit[],
  classifier: ClassifierResult,
  routes: ResponseRoute[],
): RouteDecision {
  // 2026-11-18 CSO 결정: AI 분류기만 위기·폭력으로 본 판단(possible_crisis·possible_violence·route crisis/violence)은 위기 경로로 보내지 않는다.
  // 평소 대화(clinical_distress — 마음이 힘든 이야기)로 가되 aiHeavy로 표시해 "힘든 메시지"로 센다. 직접 표현이 있는 말은 이미 explicitDecision이 처리했다.
  const aiHeavy = classifier.possibleCrisis || classifier.possibleViolence || isDanger(classifier.route);
  let route: RouteId = isDanger(classifier.route) ? "clinical_distress" : classifier.route;
  if (aiHeavy) route = moreSevere(route, "clinical_distress");
  // "weak" 키워드(예: "구체적 계획" 단독)는 강제로 route를 올리지 않는다 — 이미 분류기가 메시지
  // 원문을 보고 독립적으로 판단했으므로, 여기서 또 강제하면 즉시 판정만 우회했을 뿐 결국
  // 오탐을 만드는 셈이 된다. weak가 아닌 후보(진단/기능저하 등)만 severity에 반영한다. 위기·폭력 낱말은 직접 표현이 아니면 쓰지 않는다(위와 같은 이유).
  for (const h of hits) if (!h.weak && !isDanger(h.route)) route = moreSevere(route, h.route);

  // 확신도가 낮으면 한 단계 더 조심스러운 route로 올린다 (승인된 원칙: 애매하면 안전한 쪽으로).
  // 2026-11-18: 단, 위기·폭력으로는 올리지 않는다(예전엔 폭력이 확신 낮음이면 위기 안내가 나갔다 — CSO가 지적한 오탐 경로).
  if (classifier.confidence === "low") {
    const idx = ROUTES.findIndex((r) => r.id === route);
    if (idx > 0 && !isDanger(ROUTES[idx - 1].id)) route = ROUTES[idx - 1].id;
  }

  const routeRule = routes.find((r) => r.route_order === routeOrder(route));
  const matchedRuleIds = Array.from(new Set([...hits.map((h) => h.ruleId), ...(routeRule?.required_policy ?? [])]));

  return {
    route,
    matchedRuleIds,
    source: hits.length ? "keyword+classifier" : "classifier",
    confidence: classifier.confidence,
    classifierUnavailable: false,
    reasoning: classifier.reasoning,
    classifierUsage: classifier.usage,
    ...(aiHeavy ? { aiHeavy: true } : {}),
  };
}
