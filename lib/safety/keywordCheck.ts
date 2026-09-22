import type { SafetyRule } from "./rules.ts";
import { routeOrder, type RouteId } from "./types.ts";

// 어떤 safety_rules 규칙이 어떤 route의 "즉시 판정" 후보인지.
// route 1(crisis)·2(violence)만 즉시 고정 응답으로 이어진다. 3·4(진단/기능저하)는
// 검색·답변 생성이 필요한 route라서, 여기서 찾은 것은 분류기 결과와 합쳐 쓸 "후보"일 뿐이다.
const RULE_ROUTE: Partial<Record<string, RouteId>> = {
  "SAFE-013": "crisis",
  "SAFE-001": "violence",
  "SAFE-003": "clinical_diagnosis",
  "SAFE-007": "clinical_diagnosis",
  "SAFE-008": "clinical_diagnosis",
  "SAFE-009": "clinical_distress",
  "SAFE-010": "clinical_distress",
  "SAFE-012": "clinical_distress",
};

// 단독으로는 무관한 문장에서도 걸리는 표현. 예: "여행 계획을 구체적으로 세웠어요".
// 이런 표현만 있을 때는 즉시 위기 응답으로 보내지 않고, 분류기가 문맥을 보고 판단하게 한다.
// (2026-09-22 결정: safety_rules 원본 데이터는 그대로 두고, 이 파일에서만 예외 처리)
const WEAK_TRIGGERS: Record<string, string[]> = {
  "SAFE-013": ["구체적 계획"],
};

export type KeywordHit = { ruleId: string; route: RouteId; trigger: string; weak: boolean };

export function findKeywordHits(message: string, rules: SafetyRule[]): KeywordHit[] {
  const hits: KeywordHit[] = [];
  const lower = message.toLowerCase();
  for (const rule of rules) {
    const route = RULE_ROUTE[rule.rule_id];
    if (!route) continue;
    const weakList = WEAK_TRIGGERS[rule.rule_id] ?? [];
    for (const trigger of rule.trigger ?? []) {
      if (trigger && lower.includes(trigger.toLowerCase())) {
        hits.push({ ruleId: rule.rule_id, route, trigger, weak: weakList.includes(trigger) });
      }
    }
  }
  return hits;
}

// route 1·2 중 "약하지 않은" 매치만 즉시 고정 응답 대상이다. 여러 개면 더 위험한 쪽을 고른다.
export function instantHit(hits: KeywordHit[]): KeywordHit | null {
  const strong = hits.filter((h) => !h.weak && (h.route === "crisis" || h.route === "violence"));
  if (!strong.length) return null;
  return strong.reduce((best, h) => (routeOrder(h.route) < routeOrder(best.route) ? h : best));
}
