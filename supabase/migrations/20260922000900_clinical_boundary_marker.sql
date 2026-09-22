-- 2026-09-22: "진단을 대신할 수 없어요" 같은 전문가 상담 안내 문구를 세션당 1번만 명시적으로
-- 말하고, 그 다음부터는 반복하지 않고 구체적인 자기돌봄 제안으로 넘어가기 위한 마커.
-- persona_snapshot(20260922000800)과 같은 패턴: 세션에 1회 기록해두고 이후 턴에서 참고만 한다.
alter table chat_sessions
  add column if not exists clinical_boundary_stated_at timestamptz;

comment on column chat_sessions.clinical_boundary_stated_at is
  '이 세션에서 전문가 상담 안내(정신건강의학과 등)를 처음 전달한 시각. null이면 아직 안 함 — 있으면 이후 턴에서는 문구를 반복하지 않고 자기돌봄 제안으로 대체한다.';
