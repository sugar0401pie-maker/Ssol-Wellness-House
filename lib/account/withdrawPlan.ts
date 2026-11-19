// 회원 탈퇴(2026-11-19 대표님 결정: "쏘웰라 정보만 삭제") — 무엇을 지우고 무엇을 남기는지 한곳에 둔 순수 목록(시험으로 지킨다).
// 계정(auth.users)은 쏠 웰니스 하우스 심리테스트·타로·아스트로 사이트와 같은 계정이라 지우지 않는다. 그쪽 결과(ssol_* · tarot_* · astro_*)도 손대지 않는다(CLAUDE.md §5).
// 결제 기록(chat_entitlements)은 개인정보 처리방침 5항(전자상거래법 대금결제 기록 5년)에 따라 남긴다.
// 대화를 처음 쓴 날(profiles.trial_started_at)도 남긴다 — 탈퇴·재가입으로 무료체험을 되풀이하는 부정 이용 방지(방침 5항 "부정 이용 방지 기록").

// 사용자 행을 통째로 지우는 표(user_id 기준). 순서: 해석 기록(sw_purge_user가 따로 지움) 다음 대화 → 그 밖의 쏘웰라 기록.
export const WITHDRAW_DELETE_TABLES = [
  "sw_hypothesis_log", // sw_user_last_activity는 뷰라 위 기록이 지워지면 함께 비워진다
  "chat_messages", "chat_sessions",
  "user_memory", "user_onboarding", "wellness_profiles", "counselor_inquiries", "customer_feedback",
] as const;

// 남기는 표(지우지 않음 — 시험이 이 목록이 위 목록과 겹치지 않는지 본다).
export const WITHDRAW_KEEP_TABLES = ["chat_entitlements", "ssol_profiles", "ssol_quiz_results", "ssol_reports", "ssol_orders", "tarot_sessions", "astro_results"] as const;

// profiles 행은 계정에 붙어 있어(가입 때 트리거가 만듦) 지우지 않고 쏘웰라에서 받은 값만 비운다. 이용 시작일(trial_started_at)·locale은 남긴다.
export const PROFILE_RESET = {
  display_name: null, nickname: null, birth_year: null, birth_date: null, phone: null, address: null,
  marketing_consent: false, marketing_consent_at: null, ai_training_consent: true, ai_training_consent_at: null,
  terms_agreed_at: null, sensitive_data_agreed_at: null, adult_confirmed_at: null, kr_resident_confirmed_at: null,
  onboarding_completed_at: null, enjoyment_category: null, concern_domain: null, concern_other: null, primary_quiz_result_id: null,
} as const;

// 팝업 문장(대표님 확인용 초안 — 2026-11-19).
export const WITHDRAW_DONE_TEXT = "정상적으로 탈퇴 처리 되었습니다. 그동안 쏘웰라AI를 이용해주셔서 감사합니다.";
export function withdrawNotice(nickname: string | null | undefined): string {
  return `회원 탈퇴 시 쏘웰라AI에 저장된 ${nickname?.trim() ? `${nickname.trim()}님` : "회원님"}의 정보가 삭제됩니다.`;
}
export const WITHDRAW_DETAILS: readonly string[] = [
  "삭제되는 정보: 쏘웰라와 나눈 대화, 대화로 파악한 경향과 해석 기록, 온보딩 답변, 연습 기록, 쏘웰라에 입력한 내 정보(이름·닉네임·연락처·주소 등)",
  "남는 정보: 결제 기록은 개인정보 처리방침에 따라 전자상거래법상 보존 기간(대금결제 기록 5년) 동안 보관한 뒤 파기됩니다.",
  "같은 계정으로 이용하신 쏠 웰니스 하우스 심리테스트·타로 결과는 그대로 남습니다.",
  "삭제된 정보는 다시 되돌릴 수 없습니다.",
];
