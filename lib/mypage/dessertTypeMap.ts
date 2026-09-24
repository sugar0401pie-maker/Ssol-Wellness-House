// ssol_quiz_results.type_key(예: "CAR-primary")를 persona_profiles.code로 바꾼다.
// 출처: final-ssol-wellness-v2-master-spec.md §6.4 "15유형 디저트 배정 v2" — 문서의 DESSERT
// 데이터를 그대로 옮겼다(icon 값을 persona_profiles.code로 사용).
//
// 2026-09-24: v1(10유형, "happy_E" 같은 {영역}_{F|E} 형식)에서 v2(15유형,
// "CAR-primary" 같은 {영역코드}-{대처방식} 형식)로 심리테스트가 개편됐다. v1 매핑
// (TYPE_KEY_TO_DESSERT, PLAN.md §7-9 기준)은 더 이상 실제 데이터와 맞지 않아 폐기.
export const TYPE_KEY_TO_DESSERT: Record<string, string> = {
  "CAR-primary": "brownie",
  "CAR-secondary": "tiramisu",
  "CAR-disengage": "affogato",

  "LOV-primary": "shortcake",
  "LOV-secondary": "berrycheesecake",
  "LOV-disengage": "berrysorbet",

  "REL-primary": "millefeuille",
  "REL-secondary": "macaron",
  "REL-disengage": "meringue",

  "SLF-primary": "basquecake",
  "SLF-secondary": "madeleine",
  "SLF-disengage": "castella",

  "DIR-primary": "croissant",
  "DIR-secondary": "lemontart",
  "DIR-disengage": "fruittart",
};
