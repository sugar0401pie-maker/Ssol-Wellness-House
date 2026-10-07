// 이론 고르기에서 자주 헷갈리는 쌍의 구분 단서(2026-10-07). 이론 설명(plain_focus)은 owner가 검수한 사용자 노출 가능 문구라 고치지 않고,
// 이론 선택 프롬프트의 해당 이론 줄 끝에만 짧게 덧붙인다. 단서의 출처는 판별 예시 문장 추가본(SSOL_Signals_Add_v0_1.xlsx)의
// "경계" 문장 메모(owner 작성) — 새로 지어내지 않았다. 평가에서 가장 많이 틀린 쌍(EFT↔IPT, ACT↔LOGO)부터 시작했고, 로그를 보며 늘린다.
//
// 측정(luna, 재판정 라벨 85문장, 방식당 3회): 줄 끝 덧붙이기가 정답률 90~93%·정밀도 93~96%로 기준(89~91%·89~93%)과 같거나 약간 좋았고,
// 복직 IPT·엄마와 통화하면 싸움 문장이 고쳐졌다. 별도 문단으로 붙이는 방식은 83~88%로 오히려 나빠서 쓰지 않는다
// (scripts/theory_select_variants_eval.mjs). EFT 단서를 "연인·부부"로 좁힌 것도 평가에서 가족 갈등 문장이 EFT로 쏠린 것을 막으려는 것이다.
export const SELECT_SUFFIXES: Record<string, string> = {
  EFT: "※ 연인·부부 사이에서 '내가 이 사람한테 중요한가'·위로가 안 닿음·싸운 뒤 멀어질까 무서움·다가가면 물러나는 되풀이",
  IPT: "※ 분담·기대 차이·역할 변화·새 상황 — 정서적 연결 단서가 없으면 연애여도 IPT",
  ACT: "※ 방향은 아는데 불안·생각이 올라오면 멈추거나 피함",
  LOGO: "※ 무엇이 의미인지 모름·속이 빈 느낌·나 밖을 향한 쓰임·유머로 부풀려 웃어넘기기",
};

// 선택 프롬프트에 넣을 이론 목록에 구분 단서를 덧붙인다(없는 이론은 그대로).
export function applySelectSuffixes<T extends { id: string; focus: string }>(theories: T[], suffixes: Record<string, string> = SELECT_SUFFIXES): T[] {
  return theories.map((t) => (suffixes[t.id] ? { ...t, focus: `${t.focus} ${suffixes[t.id]}` } : t));
}
