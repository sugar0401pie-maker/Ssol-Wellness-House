// route.ts의 "판정 합치기" 로직을 네트워크 호출 없이 테스트할 수 있도록 분리한 순수 함수들.
import type { KeywordHit } from "./keywordCheck.ts";
import type { ClassifierResult } from "./classify.ts";
import type { ResponseRoute } from "./rules.ts";
import { ROUTES, moreSevere, routeOrder, type RouteDecision } from "./types.ts";

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
  const candidate = hits.length
    ? hits.reduce((best, h) => (routeOrder(h.route) < routeOrder(best.route) ? h : best))
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
  let route = classifier.route;
  if (classifier.possibleCrisis) route = moreSevere(route, "crisis");
  if (classifier.possibleViolence) route = moreSevere(route, "violence");
  // "weak" 키워드(예: "구체적 계획" 단독)는 강제로 route를 올리지 않는다 — 이미 분류기가 메시지
  // 원문을 보고 독립적으로 판단했으므로, 여기서 또 강제하면 즉시 판정만 우회했을 뿐 결국
  // 오탐을 만드는 셈이 된다. weak가 아닌 후보(진단/기능저하 등)만 severity에 반영한다.
  for (const h of hits) if (!h.weak) route = moreSevere(route, h.route);

  // 확신도가 낮으면 한 단계 더 조심스러운 route로 올린다 (승인된 원칙: 애매하면 안전한 쪽으로).
  if (classifier.confidence === "low") {
    const idx = ROUTES.findIndex((r) => r.id === route);
    if (idx > 0) route = ROUTES[idx - 1].id;
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
  };
}
