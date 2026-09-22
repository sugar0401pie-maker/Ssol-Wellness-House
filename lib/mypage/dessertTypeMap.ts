// ssol_quiz_results.type_key(예: "happy_E")를 우리 dessert_type 코드로 바꾼다.
// 출처: PLAN.md §7-9 "유형 ↔ DB 코드 매핑" — 프로토타입 원본과 대조 확인된 표. 여기서
// 임의로 새로 만들지 않고 그 표를 그대로 옮겼다.
export const TYPE_KEY_TO_DESSERT: Record<string, string> = {
  relate_F: "strawberry_macaron",
  relate_E: "cream_bread",
  worth_F: "millefeuille",
  worth_E: "meringue_cookie",
  control_F: "tiramisu",
  control_E: "caramel_pudding",
  happy_F: "yogurt_parfait",
  happy_E: "espresso_brownie",
  meaning_F: "pistachio_croissant",
  meaning_E: "castella",
};
