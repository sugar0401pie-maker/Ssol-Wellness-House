// 심리테스트의 5개 영역 키↔한국어 라벨. 서버(generate.ts의 페르소나 힌트)와
// 클라이언트(마이페이지 화면)가 같은 라벨을 쓰도록 여기 한 곳에 모아둔다.
// I/O가 없는 순수 상수라 "use client"/"server-only" 어느 쪽에서도 안전하게 import할 수 있다.
//
// 2026-09-24: 심리테스트가 v2로 개편되면서 영역 체계가 완전히 바뀌었다(final-ssol-wellness-v2
// -master-spec.md 기준). 예전 5개 영역(관계·소속/자기가치·인정/통제·미래/행복/의미·방향)은
// 더 이상 쓰지 않는다 — ssol_quiz_results.domain_scores의 키도 이제 CAR/LOV/REL/SLF/DIR이다.
// 점수 의미도 바뀌었다: 예전엔 "그렇다에 답한 총량"이었지만, v2는 "그 영역이 얼마나 건강하게
// 채워져 있나"(높을수록 좋음)이고, 주 고민 영역은 점수가 가장 "낮은" 영역이다(예전엔 가장
// 높은 영역). 채팅에서 점수를 언급할 때 이 방향을 뒤집어 말하지 않도록 주의할 것.
export const DOMAIN_LABELS: Record<string, string> = {
  CAR: "커리어",
  LOV: "연애",
  REL: "관계",
  SLF: "나 자신",
  DIR: "삶의 방향",
};
