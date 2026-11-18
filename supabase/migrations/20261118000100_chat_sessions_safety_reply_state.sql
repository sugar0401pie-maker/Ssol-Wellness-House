-- =====================================================================
-- SSOL Wellness House — migration: 대화별 안전 응답 상태 (safety_reply_state)
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-11-18 CSO 결정: 안전 신호 뒤에는 고정 안내문 대신 공감하고 듣는다. 한 대화에서 힘든 메시지가 4번째일 때 한 번만
-- 마이페이지 안내 + 버튼을 붙이고, 같은 문장은 되풀이하지 않는다 — 이를 위해 대화마다 "몇 번째인지·이미 쓴 문장 id"를 기억할 칸이다.
-- 대화 원문은 넣지 않는다(문장 id와 횟수만). 칸이 없어도 채팅은 동작하지만, 매 메시지를 새 대화처럼 보게 된다.
-- 여러 번 실행해도 안전하다.
-- =====================================================================

begin;

alter table public.chat_sessions add column if not exists safety_reply_state jsonb;

comment on column public.chat_sessions.safety_reply_state is '안전 신호 뒤 응답 상태(쓴 문장 id·힘든 메시지 수·마이페이지 안내 여부). 원문 없음. lib/safety/safetyReply.ts';

notify pgrst, 'reload schema';

commit;
