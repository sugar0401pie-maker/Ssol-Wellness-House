// 2026-10-01 owner 요청: 홈 탭/심층보고서의 캐릭터 이미지를 유형별 고정 1장이 아니라
// public/characters/<code>/1.png ~ 5.png(5가지 변형, owner가 준 75장 세트) 중에서 매번
// 랜덤하게 하나를 보여준다. 순수 함수라 양쪽 화면(HomeTab, ReportDetailPage)이 독립적으로
// 호출해서 서로 다른 변형이 나올 수 있다(owner가 명시적으로 원한 동작).
export const CHARACTER_VARIANT_COUNT = 5;

export function pickRandomVariant(): number {
  return 1 + Math.floor(Math.random() * CHARACTER_VARIANT_COUNT);
}
