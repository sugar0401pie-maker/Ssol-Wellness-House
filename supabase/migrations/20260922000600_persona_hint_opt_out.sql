-- =====================================================================
-- SSOL Wellness House — migration 007: 웰니스 유형(디저트 유형) 힌트 opt-out 준비
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-09-22 결정: 웰니스 유형(디저트 유형)을 상담 관점·프레임워크 힌트로 기본 반영하되,
-- 나중에 사용자가 원하면 끌 수 있게 한다. 지금은 끄는 화면(UI)이 없지만, 나중에 설정 화면을
-- 만들 때 새 마이그레이션 없이 바로 쓸 수 있도록 컬럼만 미리 추가해둔다.
-- 여러 번 실행해도 안전하다.
-- =====================================================================

begin;

alter table public.wellness_profiles
  add column if not exists persona_hint_opt_out boolean not null default false;

comment on column public.wellness_profiles.persona_hint_opt_out is
  'true면 답변 생성 시 이 사용자의 웰니스 유형(디저트 유형)을 관점 힌트로 쓰지 않는다. 기본값 false(사용).
   진단이나 하드 필터로는 절대 쓰지 않음 — SAFE-005. 끄는 화면은 아직 없음(추후 설정 UI에서 사용 예정).';

commit;
