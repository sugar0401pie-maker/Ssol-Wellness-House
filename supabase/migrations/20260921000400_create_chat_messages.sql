-- =====================================================================
-- SSOL Wellness House — migration 005: chat_messages 테이블 생성
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 001에서 만들려던 chat_messages가 실제로는 생성되지 않았습니다
-- (그때 같은 이름의 다른 테이블이 있어 "이미 있으면 건너뛰기"로 넘어갔음).
-- 그 테이블은 지금 ssol_chat_messages(다른 앱 소유)로 이름이 바뀌어 있고, 이 SQL은 건드리지 않습니다.
--
-- 안전장치: 같은 이름의 "다른 구조" 테이블이 이미 있으면 조용히 넘어가지 않고 오류로 멈춥니다.
-- 여러 번 실행해도 안전합니다. 전체가 하나의 트랜잭션입니다.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.chat_messages') is not null then
    -- 이미 있으면: 우리 구조(session_id 컬럼)인지 확인
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'chat_messages' and column_name = 'session_id'
    ) then
      raise exception 'public.chat_messages가 이미 있는데 우리 구조가 아닙니다. 실행을 중단합니다. (다른 앱의 테이블일 수 있음)';
    end if;
    raise notice 'chat_messages는 이미 우리 구조로 존재합니다. 생성은 건너뜁니다.';
  else
    create table public.chat_messages (
      message_id          uuid primary key default gen_random_uuid(),
      session_id          uuid not null references public.chat_sessions (session_id) on delete cascade,
      user_id             uuid not null references auth.users (id) on delete cascade,
      role                text not null check (role in ('user', 'assistant')),
      content             text not null,
      route               text,        -- 안전 라우터가 정한 경로 (예: crisis_safety, clinical_boundary, wellness)
      retrieved_chunk_ids text[],      -- 이 답변에 사용된 knowledge_chunks.chunk_id
      framework_id        text,
      feedback            smallint check (feedback in (-1, 0, 1)),
      created_at          timestamptz not null default now()
    );
  end if;
end
$$;

comment on column public.chat_messages.content is
  '민감정보가 포함될 수 있음. 보관 12개월 후 자동 삭제 예정(별도 마이그레이션), 로그·분석에 원문 복제 금지.';

create index if not exists chat_messages_session_idx on public.chat_messages (session_id, created_at);
create index if not exists chat_messages_user_idx    on public.chat_messages (user_id);

-- 보안 -------------------------------------------------------------------
alter table public.chat_messages enable row level security;

revoke all on public.chat_messages from anon, authenticated;

-- 회원(익명 포함): 본인 메시지 조회·삭제, 피드백(feedback) 컬럼만 수정. 저장은 서버만.
grant select, delete on public.chat_messages to authenticated;
grant update (feedback) on public.chat_messages to authenticated;
-- 서버 키
grant select, insert, update, delete on public.chat_messages to service_role;

drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own" on public.chat_messages
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "chat_messages_delete_own" on public.chat_messages;
create policy "chat_messages_delete_own" on public.chat_messages
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "chat_messages_update_feedback_own" on public.chat_messages;
create policy "chat_messages_update_feedback_own" on public.chat_messages
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';

commit;
