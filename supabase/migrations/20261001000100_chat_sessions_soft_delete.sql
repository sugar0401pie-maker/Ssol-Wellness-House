-- =====================================================================
-- SSOL Wellness House — migration: 지난 대화 목록 "삭제" (소프트 삭제)
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-10-01 owner 요청: "지난 대화" 목록에서 삭제 버튼을 눌러도 실제로는 DB에 그대로
-- 남겨둔다(데이터 보존) — 목록에서만 숨긴다. chat_sessions.deleted_at을 세우는 방식으로
-- 처리하고, 조회(GET /api/chat/sessions)에서 deleted_at is null인 것만 돌려준다.
-- 실제 하드 삭제(delete)는 20260921000000_mvp_schema.sql에서 authenticated에게 이미
-- 허용돼 있지만(본인 행만), 이번 기능은 그 경로를 쓰지 않고 서버(service_role)의 update로만
-- deleted_at을 세운다 — 다른 서버 쓰기 경로(메시지 저장 등)와 같은 패턴을 유지한다.
-- =====================================================================

begin;

alter table public.chat_sessions add column if not exists deleted_at timestamptz;

commit;
