// 안전 라우팅의 핵심 로직 테스트. 네트워크(OpenAI·Supabase) 없이 순수 함수만 검사한다.
// 실행: npm test   (Node 내장 테스트 러너, 별도 설치 불필요)
//
// 여기서 다루는 것: 키워드 즉시 판정, 약한 표현 예외, 분류기 결과와의 결합, 확신도 낮음 escalation,
// 분류기 실패 시 fail-safe. 실제 AI 분류기 품질은 별도 스크립트(scripts/safety-eval.mjs)로 확인한다.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { findKeywordHits, instantHit } from "./keywordCheck.ts";
import {
  decisionFromInstantHit,
  decisionOnClassifierFailure,
  combineWithClassifier,
  explicitDecision,
} from "./combine.ts";
import { moreSevere, routeOrder } from "./types.ts";
import type { SafetyRule, ResponseRoute } from "./rules.ts";
import type { ClassifierResult } from "./classify.ts";

// 실제 DB의 safety_rules 값 (2026-09-22 기준). DB가 바뀌면 이 테스트도 함께 갱신해야 한다.
const RULES: SafetyRule[] = [
  { rule_id: "SAFE-001", category: "Relationship Safety", trigger: ["신체적 폭력", "성적 강요", "협박", "스토킹", "지속적 모욕/위협", "경제적/사회적 통제"], rule_text: "", priority: "Critical", handoff_action: null },
  { rule_id: "SAFE-003", category: "No Diagnosis", trigger: ["우울증", "불안장애", "ADHD", "공황장애", "양극성장애", "PTSD", "섭식장애", "애착유형", "HSP", "기타 진단명"], rule_text: "", priority: "Critical", handoff_action: null },
  { rule_id: "SAFE-007", category: "Global Medical", trigger: ["ADHD", "우울증", "공황장애", "불안장애", "양극성장애", "섭식장애", "PTSD", "정신건강 질환", "진단", "치료"], rule_text: "", priority: "Critical", handoff_action: null },
  { rule_id: "SAFE-008", category: "Medication Boundary", trigger: ["항우울제", "ADHD 약", "수면제", "정신과 약", "약물 시작", "중단", "용량", "부작용"], rule_text: "", priority: "Critical", handoff_action: null },
  { rule_id: "SAFE-009", category: "Depression Boundary", trigger: ["우울감 지속", "무기력", "수면/식사 변화", "집중 저하", "일상 기능 저하"], rule_text: "", priority: "Critical", handoff_action: null },
  { rule_id: "SAFE-010", category: "Panic Boundary", trigger: ["공황발작", "흉통", "호흡곤란", "실신감", "반복적 강한 공포"], rule_text: "", priority: "Critical", handoff_action: null },
  { rule_id: "SAFE-012", category: "Mindfulness/Trauma", trigger: ["명상 중 공황", "해리", "트라우마 기억", "바디스캔 불편", "강한 불안"], rule_text: "", priority: "Critical", handoff_action: null },
  { rule_id: "SAFE-013", category: "Suicide/Self-harm", trigger: ["죽고 싶다", "자살", "자해", "살 이유가 없다", "생을 마감", "해치고 싶다", "구체적 계획"], rule_text: "", priority: "Critical", handoff_action: null },
];
const ROUTES_TABLE: ResponseRoute[] = [
  { route_order: 1, intent_or_trigger: "", required_policy: ["SAFE-013"], retrieval_scope: "", top_k: 0, forbidden: null, notes: null },
  { route_order: 2, intent_or_trigger: "", required_policy: ["SAFE-001"], retrieval_scope: "", top_k: 2, forbidden: null, notes: null },
  { route_order: 3, intent_or_trigger: "", required_policy: ["SAFE-003", "SAFE-007", "SAFE-008"], retrieval_scope: "", top_k: 3, forbidden: null, notes: null },
  { route_order: 4, intent_or_trigger: "", required_policy: ["SAFE-009", "SAFE-010", "SAFE-012"], retrieval_scope: "", top_k: 3, forbidden: null, notes: null },
  { route_order: 5, intent_or_trigger: "", required_policy: ["SAFE-002"], retrieval_scope: "", top_k: 5, forbidden: null, notes: null },
  { route_order: 6, intent_or_trigger: "", required_policy: ["SAFE-004", "SAFE-005"], retrieval_scope: "", top_k: 5, forbidden: null, notes: null },
  { route_order: 7, intent_or_trigger: "", required_policy: ["SAFE-016"], retrieval_scope: "", top_k: 5, forbidden: null, notes: null },
];

function classifierSays(partial: Partial<ClassifierResult> & { route: ClassifierResult["route"] }): ClassifierResult {
  return {
    confidence: "high",
    possibleCrisis: false,
    possibleViolence: false,
    reasoning: "test",
    usage: { inputTokens: 0, outputTokens: 0 },
    ...partial,
  };
}

describe("키워드 검사", () => {
  test("명백한 자살/자해 표현은 즉시 crisis로 판정된다 (분류기 호출 없이)", () => {
    const hits = findKeywordHits("이제 다 그만두고 자살하고 싶어요", RULES);
    const hit = instantHit(hits);
    assert.equal(hit?.route, "crisis");
    const decision = decisionFromInstantHit(hit!, hits);
    assert.equal(decision.route, "crisis");
    assert.equal(decision.confidence, "high");
    assert.equal(decision.source, "keyword");
    assert.deepEqual(decision.matchedRuleIds, ["SAFE-013"]);
  });

  test("명백한 폭력/스토킹 표현은 즉시 violence로 판정된다", () => {
    const hits = findKeywordHits("헤어지자고 했더니 계속 스토킹을 해요", RULES);
    const hit = instantHit(hits);
    assert.equal(hit?.route, "violence");
  });

  test("'구체적 계획'만 있는 무관한 문장은 즉시 위기로 판정하지 않는다 (오탐 방지)", () => {
    const hits = findKeywordHits("여행 계획을 구체적 계획까지 다 세웠어요", RULES);
    assert.equal(hits.length > 0, true); // 매치는 되지만
    assert.equal(instantHit(hits), null); // 즉시 판정 대상은 아니다
  });

  test("진단/약물 관련 키워드는 route 3 후보로만 잡힌다 (즉시 판정 아님)", () => {
    const hits = findKeywordHits("저 ADHD인 것 같은데 약물 시작해도 될까요?", RULES);
    assert.equal(instantHit(hits), null);
    assert.equal(hits.some((h) => h.route === "clinical_diagnosis"), true);
  });

  test("우울/공황 관련 키워드는 route 4 후보로 잡힌다", () => {
    const hits = findKeywordHits("공황발작이 반복돼요", RULES);
    assert.equal(hits.some((h) => h.route === "clinical_distress"), true);
  });

  test("관련 없는 일상 문장은 아무것도 매치되지 않는다", () => {
    assert.deepEqual(findKeywordHits("오늘 점심 뭐 먹을지 고민이에요", RULES), []);
  });

  test("회귀 테스트: '무기력'/'진단'/'치료'/'중단'/'용량'/'부작용' 같은 흔한 단어는 매치는 되지만 weak로 표시된다", () => {
    // 2026-09-22 실사용 중 발견: 이 단어들 하나만으로 일상 대화가 전부 의료 경계로 강제 이동하던 버그.
    const cases: [string, string][] = [
      ["오늘 하루 종일 좀 무기력하네요", "SAFE-009"],
      ["정확한 진단이 필요한 문제 같아요, 차가 이상해서요", "SAFE-007"],
      ["이 문제를 어떻게 치료해야 할지 모르겠어요", "SAFE-007"],
      ["회의를 중단해야 할지 계속해야 할지 고민이에요", "SAFE-008"],
      ["이 정도 용량이면 충분할까요?", "SAFE-008"],
      ["이 정책의 부작용이 걱정돼요", "SAFE-008"],
    ];
    for (const [msg, ruleId] of cases) {
      const hits = findKeywordHits(msg, RULES);
      const hit = hits.find((h) => h.ruleId === ruleId);
      assert.ok(hit, `"${msg}"에서 ${ruleId} 매치를 찾지 못함`);
      assert.equal(hit!.weak, true, `"${msg}"의 ${ruleId} 매치가 weak여야 함`);
    }
  });
});

describe("severity 비교", () => {
  test("moreSevere는 route_order가 더 작은(더 위험한) 쪽을 고른다", () => {
    assert.equal(moreSevere("wellness", "crisis"), "crisis");
    assert.equal(moreSevere("clinical_diagnosis", "life_decision"), "clinical_diagnosis");
    assert.equal(routeOrder("crisis") < routeOrder("service_info"), true);
  });
});

describe("분류기 결과 결합", () => {
  test("분류기가 wellness라고 해도 키워드 후보(clinical_distress)가 있으면 더 위험한 쪽으로 올라간다", () => {
    const hits = findKeywordHits("공황발작이 반복돼요", RULES);
    const decision = combineWithClassifier(hits, classifierSays({ route: "wellness" }), ROUTES_TABLE);
    assert.equal(decision.route, "clinical_distress");
    assert.equal(decision.source, "keyword+classifier");
  });

  // 2026-11-18 CSO 결정(개발 요청 v1.3 §2-1)으로 바뀐 방침: AI 분류만으로 올린 판단은 위기 안내 대상이 아니다.
  // 예전 시험("possible_crisis면 crisis로 올라간다")은 이 결정으로 뒤집혔다 — 대신 아래처럼 평소 대화 + 힘든 메시지 표시를 확인한다.
  test("분류기만 possible_crisis를 표시하면 위기 경로로 가지 않고, 마음이 힘든 대화(clinical_distress)로 가며 힘든 메시지로 표시된다", () => {
    const decision = combineWithClassifier(
      [],
      classifierSays({ route: "wellness", possibleCrisis: true }),
      ROUTES_TABLE,
    );
    assert.equal(decision.route, "clinical_distress");
    assert.equal(decision.aiHeavy, true);
  });

  test("분류기만 crisis·violence로 판단해도 위기·폭력 경로로 가지 않는다(직접 표현이 없으면)", () => {
    for (const route of ["crisis", "violence"] as const) {
      const d = combineWithClassifier([], classifierSays({ route }), ROUTES_TABLE);
      assert.equal(d.route, "clinical_distress", route);
      assert.equal(d.aiHeavy, true);
    }
    assert.equal(combineWithClassifier([], classifierSays({ route: "wellness", possibleViolence: true }), ROUTES_TABLE).route, "clinical_distress");
  });

  test("확신도가 낮으면 한 단계 더 위험한 쪽으로 올라간다", () => {
    const decision = combineWithClassifier([], classifierSays({ route: "wellness", confidence: "low" }), ROUTES_TABLE);
    assert.equal(decision.route, "life_decision"); // wellness(6) → life_decision(5)
  });

  // 2026-11-18: 확신도 낮음으로 위기·폭력까지 올라가던 경로(예: 폭력 + 확신 낮음 → 위기 안내)를 막는다(CSO가 지적한 오탐 경로).
  test("확신도가 낮아도 위기·폭력으로는 올리지 않는다", () => {
    assert.equal(combineWithClassifier([], classifierSays({ route: "clinical_diagnosis", confidence: "low" }), ROUTES_TABLE).route, "clinical_diagnosis");
    assert.equal(combineWithClassifier([], classifierSays({ route: "crisis", confidence: "low" }), ROUTES_TABLE).route, "clinical_diagnosis");
  });

  test("route에 해당하는 required_policy(SAFE 규칙 id)가 matchedRuleIds에 포함된다", () => {
    const decision = combineWithClassifier([], classifierSays({ route: "clinical_distress" }), ROUTES_TABLE);
    assert.deepEqual(decision.matchedRuleIds.sort(), ["SAFE-009", "SAFE-010", "SAFE-012"]);
  });

  test("회귀 테스트: '구체적 계획' 같은 weak 키워드는 분류기가 wellness로 봤으면 crisis로 강제 승격되지 않는다", () => {
    // 2026-09-22 실제 평가(safety-eval.mjs)에서 발견된 버그: weak 키워드도 무조건 moreSevere에
    // 넣고 있어서, 분류기가 명확히 안전하다고 판단해도 결국 crisis로 되돌아갔다.
    const hits = findKeywordHits("오늘 프로젝트 마감 계획을 구체적 계획까지 다 세웠어요", RULES);
    assert.equal(hits.some((h) => h.weak), true); // 전제 확인: 이 문장은 weak 매치를 만든다
    const decision = combineWithClassifier(hits, classifierSays({ route: "wellness" }), ROUTES_TABLE);
    assert.equal(decision.route, "wellness");
  });
});

describe("분류기 호출 실패 시 fail-safe", () => {
  test("키워드 후보가 없으면 classifierUnavailable=true와 함께 wellness로 두되, 절대 내용을 만들지 않는다", () => {
    const decision = decisionOnClassifierFailure([], "network error");
    assert.equal(decision.classifierUnavailable, true);
    assert.equal(decision.route, "wellness");
  });

  test("키워드 후보(진단 등)가 있으면 그 route를 쓰고 여전히 unavailable로 표시한다", () => {
    const hits = findKeywordHits("공황발작이 반복돼요", RULES);
    const decision = decisionOnClassifierFailure(hits, "timeout");
    assert.equal(decision.classifierUnavailable, true);
    assert.equal(decision.route, "clinical_distress");
  });
});

// 2026-11-18 CSO 결정(개발 요청 v1.3 §2): 위기·폭력 경로는 이용자 글에 직접 쓰인 표현이 있을 때만. 분류기를 부르지 않고 바로 결정한다.
describe("직접 표현 판정 — 위기·폭력 경로의 유일한 입구", () => {
  const decide = (m: string) => explicitDecision(m, findKeywordHits(m, RULES));
  test("죽음·자해를 직접 말하면 위기(신호 S1-b), 분류기 호출 없이", () => {
    for (const m of ["자살하고 싶어요", "죽고 싶다", "나 그냥 죽을 거야"]) {
      const d = decide(m);
      assert.equal(d?.route, "crisis", m);
      assert.equal(d?.source, "keyword");
      assert.ok(d?.safetyCodes?.includes("S1-b"), m);
    }
  });
  test("약을 한꺼번에 먹었다는 말은 위기 + 응급 신호(S7-a)", () => {
    const d = decide("방금 수면제를 한 통 다 먹었어요");
    assert.equal(d?.route, "crisis");
    assert.ok(d?.safetyCodes?.includes("S7-a"));
  });
  test("구체적인 폭력은 폭력(V1), 통제·스토킹은 V3", () => {
    assert.deepEqual([decide("남자친구한테 거의 매일 맞고 있어요")?.route, decide("남자친구한테 거의 매일 맞고 있어요")?.safetyCodes], ["violence", ["V1"]]);
    assert.equal(decide("헤어지자고 했더니 계속 스토킹을 해요")?.route, "violence");
    assert.deepEqual(decide("헤어지자고 했더니 계속 스토킹을 해요")?.safetyCodes, ["V3"]);
  });
  test("직장 괴롭힘·낱말 하나·정신적 폭력은 위기·폭력이 아님 → 분류기로(평소 대화)", () => {
    for (const m of ["팀장이 자꾸 괴롭혀서 힘들어요", "회사에서 괴롭힘을 당해요", "폭력", "남편이 정신적으로 저를 폭력적으로 대해요"]) assert.equal(decide(m), null, m);
  });
  test("'살 이유가 없다'·사라지고 싶다는 듣기(S1-a) — 위기 경로 아님", () => {
    for (const m of ["살 이유가 없다", "요즘 그냥 사라지고 싶어요"]) {
      const d = decide(m);
      assert.equal(d?.route, "clinical_distress", m);
      assert.deepEqual(d?.safetyCodes, ["S1-a"]);
    }
  });
  test("짧은 뒷말·일상 말은 아무것도 아님(앞 메시지 판단을 잇지 않음)", () => {
    for (const m of ["둘 다요", "마지막일지도... 모르겠오", "배고파 죽겠어요", "오늘 프로젝트 마감 계획을 구체적 계획까지 다 세웠어요"]) assert.equal(decide(m), null, m);
  });
  test("분류기 장애 때도 위기·폭력 낱말만으로는 위기 경로로 가지 않는다(직접 표현은 이미 위에서 처리)", () => {
    const hits = findKeywordHits("살 이유가 없다", RULES);
    assert.notEqual(decisionOnClassifierFailure(hits, "timeout").route, "crisis");
  });
});
