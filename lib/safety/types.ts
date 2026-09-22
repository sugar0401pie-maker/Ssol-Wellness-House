// 안전 라우팅 전체가 공유하는 타입 정의.
// route_id와 순서는 Excel의 response_routing 시트를 그대로 따른다 (숫자가 작을수록 더 위험/우선).

export const ROUTES = [
  { id: "crisis", order: 1, label: "자살/자해/구체적 위험" },
  { id: "violence", order: 2, label: "폭력/성적 강요/협박/스토킹" },
  { id: "clinical_diagnosis", order: 3, label: "진단/약물/정신건강 질환" },
  { id: "clinical_distress", order: 4, label: "우울/공황/트라우마/심한 기능저하" },
  { id: "life_decision", order: 5, label: "중요한 인생 결정" },
  { id: "wellness", order: 6, label: "일상 웰니스/관계/창작" },
  { id: "service_info", order: 7, label: "SSOL 서비스 문의" },
] as const;

export type RouteId = (typeof ROUTES)[number]["id"];

export function routeOrder(id: RouteId): number {
  return ROUTES.find((r) => r.id === id)!.order;
}

// 두 route 중 "더 위험한(숫자가 더 작은)" 쪽을 돌려준다. 안전 라우팅 전체의 핵심 규칙.
export function moreSevere(a: RouteId, b: RouteId): RouteId {
  return routeOrder(a) <= routeOrder(b) ? a : b;
}

export type Confidence = "high" | "medium" | "low";

export type RouteDecision = {
  route: RouteId;
  // 이 판정에 실제로 쓰인 신호. 로그·감사(safety_events)에 남긴다.
  matchedRuleIds: string[];
  source: "keyword" | "classifier" | "keyword+classifier";
  confidence: Confidence;
  // 분류기를 호출하지 못했을 때(OpenAI 장애 등). 이때도 route는 항상 채워져 있다(안전 쪽으로).
  classifierUnavailable: boolean;
  // 분류기의 판단 근거(로그·감사 전용). 사용자에게 보여주지 않는다.
  reasoning?: string;
};
