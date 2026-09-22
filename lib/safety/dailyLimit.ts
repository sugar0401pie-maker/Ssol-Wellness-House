// 하루 메시지 제한 관련 값·계산. 순수 함수라서 네트워크 없이 테스트할 수 있다.
// 위기(crisis)·폭력(violence) 응답은 이 제한과 무관하게 항상 동작해야 한다 — 실제 적용은
// app/api/chat/route.ts에서, 그 두 route를 이 제한 검사보다 먼저 처리해서 보장한다.

// 2026-09-22 결정: 하루 20회. 값을 바꿀 때는 코드 수정 없이 환경변수로도 조정할 수 있다.
export const DAILY_MESSAGE_LIMIT = Number(process.env.DAILY_MESSAGE_LIMIT || 20);

// "하루"는 한국 사용자 기준 한국 시간(KST, UTC+9, 서머타임 없음)으로 센다.
export function startOfTodayKST(now: Date = new Date()): Date {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const d = kst.getUTCDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0) - 9 * 3600 * 1000);
}
