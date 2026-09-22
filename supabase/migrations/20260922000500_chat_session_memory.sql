-- =====================================================================
-- SSOL Wellness House — migration 006: 대화별 "기억하기" 동의 처리용 컬럼
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 사용자가 "새 대화" 시작 시 "이 대화를 기억해 둘까요?"에 "예"라고 답한 세션만
-- user_memory에 요약으로 반영한다. memory_used_at은 그 반영이 끝난 시각(중복 반영 방지용)이고,
-- 반영 자체는 위기(crisis)·폭력(violence) route로 표시된 메시지를 제외하고 이루어진다
-- (app/lib/memory/summarize.ts에서 처리 — 이 마이그레이션은 컬럼만 추가한다).
-- 여러 번 실행해도 안전하다.
-- =====================================================================

begin;

alter table public.chat_sessions
  add column if not exists memory_used_at timestamptz;

comment on column public.chat_sessions.memory_used_at is
  '사용자가 이 대화를 "기억하기"로 선택해 user_memory에 반영을 마친 시각. null이면 아직 반영 안 됨(또는 선택 안 함).';

commit;
