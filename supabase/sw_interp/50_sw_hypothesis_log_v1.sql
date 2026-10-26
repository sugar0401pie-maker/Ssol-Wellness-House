-- 쏘웰라 해석 DB · 50 가설 판정 기록 (확률 방향 대비 — 2026-10-18 대표 결정, 요청서 G-2)
-- 목적: 나중에 점수를 확률로 보정하려면 "그 턴의 후보·점수·누가 골랐나·사용자 반응"이 남아 있어야 한다. 지금부터 기록만 쌓는다(판정에는 쓰지 않음).
-- 추가 전용: 새 표 1개 + 삭제 함수 확장(이 표도 지움). 기존 표·데이터는 바꾸지 않는다. 40 다음에 실행(apply_v1.6.sql에 포함).
create table if not exists public.sw_hypothesis_log (
  id bigint generated always as identity not null,
  user_id uuid not null,
  chat_id uuid,
  at timestamptz not null default now(),
  candidates jsonb not null default '[]'::jsonb,   -- [{root_id, score, grades:[...], sources:[...]}] 그 턴의 후보
  chosen_root text,                                 -- 선택된 뿌리(없으면 null)
  chosen_by text not null default 'none',           -- user(카드·확인) | ai(분류) | discriminator(가르기 질문) | none
  outcome text,                                     -- 사용자 반응(나중에 채움): confirmed | partial | rejected | no_answer | corrected
  outcome_at timestamptz,
  model_version text,
  spec_version text,
  constraint sw_hypothesis_log_pkey primary key (id),
  constraint ck_sw_hypothesis_log_chosen_by check (chosen_by in ('user', 'ai', 'discriminator', 'none')),
  constraint ck_sw_hypothesis_log_outcome check (outcome is null or outcome in ('confirmed', 'partial', 'rejected', 'no_answer', 'corrected'))
);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_hypothesis_log_user' and conrelid = 'public.sw_hypothesis_log'::regclass) then
  alter table public.sw_hypothesis_log add constraint fk_sw_hypothesis_log_user foreign key (user_id) references auth.users(id) on delete cascade;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_hypothesis_log_chat_id' and conrelid = 'public.sw_hypothesis_log'::regclass) then
  alter table public.sw_hypothesis_log add constraint fk_sw_hypothesis_log_chat_id foreign key (chat_id) references public.chat_sessions(session_id) on delete set null;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_hypothesis_log_root' and conrelid = 'public.sw_hypothesis_log'::regclass) then
  alter table public.sw_hypothesis_log add constraint fk_sw_hypothesis_log_root foreign key (chosen_root) references public.sw_ob_roots(root_id);
end if; end $$;
create index if not exists ix_sw_hypothesis_log_user on public.sw_hypothesis_log (user_id, at);
alter table public.sw_hypothesis_log enable row level security;
revoke all on public.sw_hypothesis_log from anon, authenticated;
grant all on public.sw_hypothesis_log to service_role;

-- 삭제 함수 확장: 40의 sw_purge_user에 이 표를 더한다(그 외는 40과 같음)
create or replace function public.sw_purge_user(p_user uuid, p_include_human boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb := '{}'::jsonb; n int;
begin
  delete from public.sw_evidence_events where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_evidence_events', n);
  delete from public.sw_choice_sessions where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_choice_sessions', n);
  delete from public.sw_root_turn_log where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_root_turn_log', n);
  delete from public.sw_hypothesis_log where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_hypothesis_log', n);
  delete from public.sw_user_root_state where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_user_root_state', n);
  delete from public.sw_user_signals where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_user_signals', n);
  if p_include_human then
    delete from public.sw_hs_sessions where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_hs_sessions', n);   -- sw_hs_root_judgments·sw_hs_safety 연쇄
  end if;
  return v;   -- 지운 행 수(감사 기록용)
end $$;
revoke all on function public.sw_purge_user(uuid, boolean) from public, anon, authenticated;
grant execute on function public.sw_purge_user(uuid, boolean) to service_role;
