// 학습 활용 동의(profiles.ai_training_consent) 판정 — 순수 함수(2026-10-18).
// 기본은 동의(true)이고, 마이페이지에서 거부(false)한 사람만 막는다. DB 칸이 아직 없으면(마이그레이션 전) 거부한 사람이 있을 수 없으므로 동의로 본다.
// 그 밖의 읽기 오류(네트워크 등)는 거부로 본다 — 확인하지 못한 채 문장 조각을 저장하지 않는 쪽이 안전하다.
type Res = { data: { ai_training_consent?: boolean | null } | null; error: { code?: string } | null };

export function trainingAllowed(res: Res): boolean {
  if (res.error) return res.error.code === "42703"; // 42703 = 칸 없음(마이그레이션 전)
  return res.data?.ai_training_consent !== false;
}

export function consentFromRow(row: { ai_training_consent?: boolean | null } | null | undefined): boolean {
  return row?.ai_training_consent !== false;
}
