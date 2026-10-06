// 이론 기반 실천(wellness_practices.availability / exposure_flag / exposure_step)의 "노출 제한" 규칙 — 순수 함수라
// 네트워크 없이 테스트할 수 있다(servingRules.test.ts). 채팅 추천과 홈 "오늘의 실천"이 같은 규칙을 쓴다.
//
// 2026-10-06 owner 결정(이론 탐색 프로젝트 v0.9 + 위기 이력 정의 승인):
//  - availability='after_explore'(비유·개념을 먼저 나눠야 이해되는 실천)는 해당 이론으로 탐색을 거친 대화에서만 쓴다.
//    탐색 대화가 아직 만들어지지 않았으므로 지금은 어디서도 쓰지 않는다(allowAfterExplore 기본 false).
//  - exposure_flag(평소 피하던 감정·상황에 일부러 다가가는 연습)는 **위기 이력 계정에는 전부 제외**.
//    그 외 사용자에게는 낮은 단계부터 — "1단계를 해본 뒤 2단계" 규칙은 실천 완료 기록이 아직 없어서, 기록이 생기기
//    전까지는 1단계만 열고 2단계 이상은 내보내지 않는다(maxExposureStep 기본 1, 더 조심스러운 쪽).
//  - 위기 이력 = 이 계정의 어떤 대화(삭제한 대화 포함)라도 safety_flag='crisis'였던 적이 있음(lib/safety/crisisHistory.ts).
//    이력을 알 수 없을 때(조회 실패)는 있는 것으로 본다(더 조심스러운 쪽, CLAUDE.md fail-safe).
//  - 기존 575개 실천은 availability='general', exposure_flag=false가 기본값이라 이 규칙의 영향을 받지 않는다.
export type ServingMeta = {
  availability?: string | null;
  exposureFlag?: boolean | null;
  exposureStep?: number | null;
};

export type ServingContext = {
  hasCrisisHistory: boolean;
  allowAfterExplore?: boolean;
  maxExposureStep?: number;
  // 트라우마 T0/T1 대화(lib/safety/traumaStage.ts)에서는 exposure 실천을 전부 뺀다.
  excludeExposure?: boolean;
};

export const DEFAULT_MAX_EXPOSURE_STEP = 1;

export function passesServingRules(meta: ServingMeta, ctx: ServingContext): boolean {
  if (meta.availability === "after_explore" && !ctx.allowAfterExplore) return false;
  if (meta.exposureFlag) {
    if (ctx.hasCrisisHistory || ctx.excludeExposure) return false;
    const max = ctx.maxExposureStep ?? DEFAULT_MAX_EXPOSURE_STEP;
    // 단계가 비어 있으면(데이터 오류) 가장 조심스럽게 내보내지 않는다.
    if (meta.exposureStep == null || meta.exposureStep > max) return false;
  }
  return true;
}
