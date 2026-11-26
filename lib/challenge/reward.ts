// 작심삼일 챌린지 리워드 = 쏘웰라 7일권(대표님 2026-11-26: "챌린지 3일 다 성공한 사람은 쏘웰라 7일권을 리워드로 드립니다 하고 실제로도 7일 연장해줘").
// 실제 지급은 DB 함수 grant_challenge_reward(supabase/migrations/20261126000200)가 한다 — 계정당 한 번, 남은 이용권·무료체험 뒤에 7일을 붙인다.
// 여기는 순수 함수(문구·시작 하한·날짜 표시)만. 클라이언트도 쓰므로 "server-only"를 넣지 않는다.

export const REWARD_DAYS = 7;

// 시작 전 안내(대표님 문장 그대로)
export const REWARD_PROMISE = "챌린지 3일 다 성공한 사람은 쏘웰라 7일권을 리워드로 드립니다.";

// 무료체험이 아직 남아 있으면 7일권은 체험이 끝난 뒤부터 센다(겹쳐서 체험 기간이 사라지지 않게).
// 이용권이 남아 있는 경우는 DB 함수가 직접 그 끝 뒤로 붙인다. 체험도 이용권도 없으면 지금부터(null).
export function rewardMinStart(access: { reason: "entitlement" | "trial" | "expired"; trialEndsAt: string }): string | null {
  return access.reason === "trial" ? access.trialEndsAt : null;
}

// 만료 시각 → 한국 날짜 "M월 D일"
export function kstMonthDay(iso: string): string {
  const t = new Date(new Date(iso).getTime() + 9 * 3_600_000);
  return `${t.getUTCMonth() + 1}월 ${t.getUTCDate()}일`;
}

// 3일을 다 채운 뒤 보여 줄 줄 — 만료일을 모르면 날짜 없이
export function rewardGrantedLine(expiresAt: string | null): string {
  return expiresAt
    ? `리워드로 쏘웰라 7일권을 드렸어요! ${kstMonthDay(expiresAt)}까지 쏘웰라와 이야기할 수 있어요.`
    : "리워드로 쏘웰라 7일권을 드렸어요!";
}
