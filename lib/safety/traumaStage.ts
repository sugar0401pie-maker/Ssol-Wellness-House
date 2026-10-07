// '트라우마' 말이 나왔을 때의 단계별 대응(문서 4-6-1, stabilization_set) — 순수 함수라 테스트할 수 있다.
//
// 🔒 안전 라우터(키워드 규칙 + AI 분류기)는 건드리지 않는다. 이 모듈은 라우터가 이미 일반 경로(wellness 등)로 통과시킨
// 대화 안에서만 "답변을 더 조심스럽게" 만드는 보조 신호다. 위기·폭력(T2)은 기존 고정 응답 그대로이고 여기서 다루지 않는다.
//
// 2026-10-06 owner 결정: "약한 트라우마"를 기준으로 한다.
//  - T0 일상어: "면접 트라우마가 있어서 긴장돼요"처럼 트라우마라는 말을 썼지만 지금 압도 신호는 없음
//    → 일반 경로 유지, 사건 기억을 자세히 묻지 않고, 과거 장면을 다시 떠올리게 하는 방식·불편에 머무르는 연습(exposure)은 제안하지 않음.
//  - T1 지금 압도: 장면이 계속 떠오름 · 몸 떨림·숨 막힘 · 멍함·현실감 저하
//    → 탐색을 즉시 멈추고, 안정화 방법 1~2개를 짧게 안내하고, 진정된 뒤 전문가 도움도 함께 안내.
// 신호 단어 목록은 초안이며 실제 대화 로그를 보며 넓혀 간다(키워드 방식이라 놓치는 표현이 있을 수 있음 — 놓치면 T0/일반 경로로
// 처리되고, 그 경로는 원래부터 기존 안전 규칙을 따른다).
export type TraumaStage = "T0" | "T1";

const T1_SIGNALS = [
  "계속 떠올라", "계속 떠오르", "자꾸 떠올라", "자꾸 떠오르", "장면이 떠올", "플래시백", "그때로 돌아간", "그날로 돌아간", "다시 겪는 것 같",
  "몸이 떨", "몸 떨림", "손이 떨", "숨이 막", "숨 막", "숨을 못 쉬", "숨쉬기 힘들", "가슴이 조여",
  "멍해", "멍하", "멍한 상태", "현실감", "현실 같지 않", "내가 아닌 것 같", "정신이 아득",
];
const T0_WORDS = ["트라우마", "트라우마가", "트라우마를", "트라우마도"];

// 최근 사용자 발화(현재 메시지 포함)를 보고 단계를 정한다. 현재 메시지에 신호가 없어도 직전 한두 번의 발화에서
// 압도 신호가 있었다면 T1을 유지한다(진정되기 전에 곧바로 탐색으로 돌아가지 않기 위해).
export function detectTraumaStage(message: string, recentUserMessages: string[] = []): TraumaStage | null {
  const recent = recentUserMessages.slice(-2);
  const hasT1 = (t: string) => T1_SIGNALS.some((w) => t.includes(w));
  if (hasT1(message) || recent.some(hasT1)) return "T1";
  const hasT0 = (t: string) => T0_WORDS.some((w) => t.includes(w));
  if (hasT0(message) || recent.some(hasT0)) return "T0";
  return null;
}

// 안정화 실천(문서 stabilization_set의 순서). 순서대로 앞의 것을 먼저 권한다.
export const STABILIZATION_PRACTICE_IDS = ["SELF-MIND-L1-03", "THX-CFT-01", "THX-DBT-02", "THX-DBT-15"] as const;
// 진정된 뒤에만 쓰는 2단계(지금은 권하지 않음 — 목록에 남겨 두기만 한다).
export const STABILIZATION_AFTER_CALM_IDS = ["THX-CFT-15"] as const;

// 트라우마 T0 대화에서 이론 탐색에 쓰지 않는 기법(문서 stabilization_set 제외 목록; 기법 번호는 이론 정렬본의 번호).
// 과거 장면을 떠올리거나 다시 쓰는 기법, 불편에 머무르는 연습(exposure), 눈 감고 생각을 오래 지켜보기, 애착 상처를 건드릴 수 있는 이미지 기법.
// T1(지금 압도)에서는 탐색 자체를 멈춘다.
export const TRAUMA_EXCLUDED_TECHNIQUE_NUMBERS: Record<string, string[]> = {
  "TH-ACT": ["⑤", "⑥", "⑫", "⑬", "⑳"],
  "TH-CFT": ["⑤", "⑥", "⑦", "⑩"],
};
