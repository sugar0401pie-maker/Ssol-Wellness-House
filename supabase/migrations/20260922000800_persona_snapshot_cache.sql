-- =====================================================================
-- SSOL Wellness House — migration 009: 세션당 웰니스 유형 조회 캐시
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-09-22 결정: 웰니스 유형(디저트 유형 + 상세 설명 + 5개 영역 점수)은 대화(세션)마다
-- 한 번만 조회하고, 그 세션 안에서는 재사용한다. 사용자가 대화 중간에 테스트를 다시 해도
-- 그 세션에는 반영되지 않고, 새 대화를 시작해야 최신 정보로 다시 조회한다(의도된 동작).
-- 여러 번 실행해도 안전하다.
-- =====================================================================

begin;

alter table public.chat_sessions
  add column if not exists persona_snapshot jsonb;

comment on column public.chat_sessions.persona_snapshot is
  '이 세션의 첫 메시지에서 한 번 조회한 웰니스 유형 힌트 캐시(참고용 스냅샷). null이면 아직 조회 전.
   {label, hint} 형태이며 hint가 null이면 "이 사용자는 테스트 결과 없음"으로 확정된 상태.';

commit;
