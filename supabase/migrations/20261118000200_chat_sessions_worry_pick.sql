-- =====================================================================
-- SSOL Wellness House — migration: 대화별 첫 말 세부 고민 (worry_pick)
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-11-18 CSO 묶음 v2.24 3부-2: 대화의 첫 말을 고민 문장 DB(sw_ob_worry_*)로 세부 고민 하나에 잇는다.
-- 고른 세부 고민 id · 부 고민 · 장면 · 강도 신호 id만 남긴다(대화 원문은 넣지 않음 — 엔진 안내 "원문 대신 이 값만").
-- 다음 단계(과제 제안)가 이 세부 고민의 해결책을 후보에 더할 때 읽는다. 칸이 없어도 채팅은 동작한다(기록만 안 됨).
-- 여러 번 실행해도 안전하다.
-- =====================================================================

begin;

alter table public.chat_sessions add column if not exists worry_pick jsonb;

comment on column public.chat_sessions.worry_pick is '첫 말에서 고른 세부 고민(intent_id·secondary·scene·강도 신호 id). 원문 없음. lib/worry/match.ts';

notify pgrst, 'reload schema';

commit;
