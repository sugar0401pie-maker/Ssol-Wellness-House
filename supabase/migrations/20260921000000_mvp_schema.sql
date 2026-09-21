-- =====================================================================
-- SSOL Wellness House — MVP schema (migration 001)
-- Supabase SQL Editor에 이 파일 전체를 붙여넣고 Run 하세요.
--
-- 만드는 것
--   사용자 테이블 (본인만 접근):  profiles, wellness_profiles, chat_sessions,
--                                 chat_messages, user_memory
--   지식 테이블 (서버 전용):      knowledge_chunks, safety_rules, programs,
--                                 service_knowledge, brand_knowledge
--   + pgvector 확장, knowledge_chunks.embedding 컬럼
--
-- 안전 설계 요약
--   * 모든 테이블에 Row Level Security(RLS)를 켭니다.
--   * 채팅 메시지·세션·메모리의 "쓰기"는 서버(service role)만 합니다.
--     브라우저가 직접 저장하면 안전 라우터를 우회할 수 있기 때문입니다.
--   * 지식 테이블은 브라우저(anon/authenticated)가 읽을 수 없습니다.
--   * 여러 번 실행해도 안전하도록(idempotent) 작성했습니다.
--   * 전체가 하나의 트랜잭션이라, 중간에 오류가 나면 아무것도 만들어지지 않습니다.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. 확장 (pgvector)
-- ---------------------------------------------------------------------
create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------
-- 1. 공통 함수: updated_at 자동 갱신
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- A. 사용자 테이블
-- =====================================================================

-- ---------------------------------------------------------------------
-- 2. profiles — 회원 기본 정보 (최소 수집)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  user_id                  uuid primary key references auth.users (id) on delete cascade,
  display_name             text,
  birth_year               smallint check (birth_year between 1900 and 2100),
  locale                   text not null default 'ko-KR',
  adult_confirmed_at       timestamptz,   -- "만 19세 이상" 자기 확인 시각
  kr_resident_confirmed_at timestamptz,   -- "한국 거주" 자기 확인 시각
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 회원가입(auth.users 생성) 시 profiles 행을 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 3. wellness_profiles — 디저트 유형 (개인화 전용, 진단 아님)
-- ---------------------------------------------------------------------
create table if not exists public.wellness_profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  dessert_type text check (dessert_type in (
                 'strawberry_macaron', 'cream_bread', 'millefeuille',
                 'meringue_cookie', 'tiramisu', 'caramel_pudding',
                 'yogurt_parfait', 'espresso_brownie', 'pistachio_croissant',
                 'castella')),
  theme_scores jsonb,
  source       text not null default 'self_select'
                 check (source in ('self_select', 'imported', 'retest')),
  tested_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.wellness_profiles is
  '개인화(재랭킹·표현) 전용. 진단이 아니며 안전 판단·검색 hard filter에 절대 사용하지 않는다 (SAFE-005).';

drop trigger if exists wellness_profiles_set_updated_at on public.wellness_profiles;
create trigger wellness_profiles_set_updated_at
  before update on public.wellness_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. chat_sessions — 대화 세션
-- ---------------------------------------------------------------------
create table if not exists public.chat_sessions (
  session_id      uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  safety_flag     text not null default 'none'
                    check (safety_flag in ('none', 'elevated', 'crisis')),
  topic_tag       text,
  started_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

comment on column public.chat_sessions.safety_flag is
  '세션 안전 상태. 서버만 올릴 수 있고, 세션 중 자동으로 낮추지 않는다.';

create index if not exists chat_sessions_user_recent_idx
  on public.chat_sessions (user_id, last_message_at desc);

-- ---------------------------------------------------------------------
-- 5. chat_messages — 대화 메시지
-- ---------------------------------------------------------------------
create table if not exists public.chat_messages (
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

comment on column public.chat_messages.content is
  '민감정보가 포함될 수 있음. 보관 12개월 후 자동 삭제 예정(별도 마이그레이션), 로그·분석에 원문 복제 금지.';

create index if not exists chat_messages_session_idx
  on public.chat_messages (session_id, created_at);
create index if not exists chat_messages_user_idx
  on public.chat_messages (user_id);

-- ---------------------------------------------------------------------
-- 6. user_memory — 장기 요약 (최소 정보, 1000자 이하)
-- ---------------------------------------------------------------------
create table if not exists public.user_memory (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  summary    text check (char_length(summary) <= 1000),
  updated_at timestamptz not null default now()
);

drop trigger if exists user_memory_set_updated_at on public.user_memory;
create trigger user_memory_set_updated_at
  before update on public.user_memory
  for each row execute function public.set_updated_at();

-- =====================================================================
-- B. 지식 테이블 (Excel에서 import, 서버 전용)
--    Excel의 "a|b|c" 형식 칸은 import 시 text[] 배열로 변환합니다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 7. knowledge_chunks — RAG 검색 대상 (+ pgvector embedding)
--    article_id는 articles 테이블을 만들 때(M2) FK로 연결합니다.
-- ---------------------------------------------------------------------
create table if not exists public.knowledge_chunks (
  chunk_id           text primary key,
  article_id         text not null,
  chunk_order        integer,
  chunk_title        text,
  chunk_text         text not null,
  embedding          extensions.vector(1536),  -- OpenAI text-embedding-3-small 기준. ingest 전에는 NULL
  domain_tags        text[],
  issue_tags         text[],
  wellness_theme     text[],
  persona_tags       text[],                   -- 재랭킹 보조 전용, 필터 금지
  use_when           text,
  follow_up_prompt   text,
  evidence_level     text not null,
  ai_attribution_rule text,
  do_not             text,
  do_not_apply_when  text[],                   -- 이 상황이면 chunk 사용 금지 (검색 후 강제 적용)
  priority           text,
  is_active          boolean not null default true,  -- false: 검수 전/미검증 chunk는 검색 제외
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on column public.knowledge_chunks.embedding is
  '1536차원. 다른 임베딩 모델로 바꾸면 차원을 다시 맞춰야 한다. chunk가 수백 개 이하라 벡터 인덱스는 아직 만들지 않는다.';

create index if not exists knowledge_chunks_article_idx
  on public.knowledge_chunks (article_id);

drop trigger if exists knowledge_chunks_set_updated_at on public.knowledge_chunks;
create trigger knowledge_chunks_set_updated_at
  before update on public.knowledge_chunks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 8. safety_rules — 안전 규칙 (SAFE-001 ~)
-- ---------------------------------------------------------------------
create table if not exists public.safety_rules (
  rule_id        text primary key,
  category       text not null,
  trigger        text[] not null,   -- 키워드 목록 (Excel의 "a|b|c")
  rule_text      text not null,
  priority       text not null,
  handoff_action text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists safety_rules_set_updated_at on public.safety_rules;
create trigger safety_rules_set_updated_at
  before update on public.safety_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 9. programs — 프로그램 5종
-- ---------------------------------------------------------------------
create table if not exists public.programs (
  program_id             text primary key,
  program_name           text not null,
  theoretical_base       text[],   -- 이론 목록으로 임상 범위를 추론하지 않음
  primary_domain         text[],
  target_user_signals    text[],
  core_principle         text,
  possible_benefit_domains text[],
  linked_article_ids     text[],
  linked_framework_ids   text[],
  persona_tags           text[],
  clinical_flag          text not null,
  doctor_referral_rule   text,
  evidence_status        text not null,   -- 'verify statistics' 등: 효과 수치는 검증 전 노출 금지
  source_reference       text,
  ai_usage_rule          text,
  do_not                 text[],
  service_type           text,
  active                 boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

drop trigger if exists programs_set_updated_at on public.programs;
create trigger programs_set_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 10. service_knowledge — 공식 서비스 안내
-- ---------------------------------------------------------------------
create table if not exists public.service_knowledge (
  service_id           text primary key,
  service_topic        text not null,
  official_ai_statement text not null,
  source_page          text,
  use_when             text,
  clinical_boundary    text not null,
  evidence_status      text,
  related_program_ids  text[],
  allowed_claims       text[],
  do_not               text,
  priority             text,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

drop trigger if exists service_knowledge_set_updated_at on public.service_knowledge;
create trigger service_knowledge_set_updated_at
  before update on public.service_knowledge
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 11. brand_knowledge — 브랜드 철학
-- ---------------------------------------------------------------------
create table if not exists public.brand_knowledge (
  brand_id          text primary key,
  concept           text not null,
  official_text     text not null,
  ai_interpretation text not null,
  use_when          text,
  do_not            text,
  priority          text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists brand_knowledge_set_updated_at on public.brand_knowledge;
create trigger brand_knowledge_set_updated_at
  before update on public.brand_knowledge
  for each row execute function public.set_updated_at();

-- =====================================================================
-- C. 보안: RLS + 권한
--    service role(서버 전용 키)은 RLS를 우회하므로 서버 코드는 정상 동작합니다.
-- =====================================================================

alter table public.profiles          enable row level security;
alter table public.wellness_profiles enable row level security;
alter table public.chat_sessions     enable row level security;
alter table public.chat_messages     enable row level security;
alter table public.user_memory       enable row level security;
alter table public.knowledge_chunks  enable row level security;
alter table public.safety_rules      enable row level security;
alter table public.programs          enable row level security;
alter table public.service_knowledge enable row level security;
alter table public.brand_knowledge   enable row level security;

-- 먼저 기본 권한을 모두 회수한 뒤, 필요한 것만 다시 부여
revoke all on public.profiles, public.wellness_profiles, public.chat_sessions,
              public.chat_messages, public.user_memory,
              public.knowledge_chunks, public.safety_rules, public.programs,
              public.service_knowledge, public.brand_knowledge
  from anon, authenticated;

-- 지식 테이블: 정책도 권한도 없음 → 브라우저에서는 읽기/쓰기 모두 불가 (서버만 가능)

-- profiles: 본인 조회, 본인 일부 컬럼만 수정 (행 생성은 가입 트리거가 담당)
grant select on public.profiles to authenticated;
grant update (display_name, birth_year, locale, adult_confirmed_at, kr_resident_confirmed_at)
  on public.profiles to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- wellness_profiles: 본인 조회·생성·수정·삭제
grant select, insert, update, delete on public.wellness_profiles to authenticated;

drop policy if exists "wellness_profiles_select_own" on public.wellness_profiles;
create policy "wellness_profiles_select_own" on public.wellness_profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "wellness_profiles_insert_own" on public.wellness_profiles;
create policy "wellness_profiles_insert_own" on public.wellness_profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "wellness_profiles_update_own" on public.wellness_profiles;
create policy "wellness_profiles_update_own" on public.wellness_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "wellness_profiles_delete_own" on public.wellness_profiles;
create policy "wellness_profiles_delete_own" on public.wellness_profiles
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- chat_sessions: 본인 조회·삭제만 (생성·수정은 서버)
grant select, delete on public.chat_sessions to authenticated;

drop policy if exists "chat_sessions_select_own" on public.chat_sessions;
create policy "chat_sessions_select_own" on public.chat_sessions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "chat_sessions_delete_own" on public.chat_sessions;
create policy "chat_sessions_delete_own" on public.chat_sessions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- chat_messages: 본인 조회·삭제 + 피드백(feedback) 컬럼만 수정 (생성은 서버)
grant select, delete on public.chat_messages to authenticated;
grant update (feedback) on public.chat_messages to authenticated;

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

-- user_memory: 본인 조회·삭제만 (생성·수정은 서버)
grant select, delete on public.user_memory to authenticated;

drop policy if exists "user_memory_select_own" on public.user_memory;
create policy "user_memory_select_own" on public.user_memory
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_memory_delete_own" on public.user_memory;
create policy "user_memory_delete_own" on public.user_memory
  for delete to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- =====================================================================
-- 실행 후 확인용 쿼리 (선택): 10개 테이블이 보이고 rowsecurity가 모두 true면 성공
--
-- select tablename, rowsecurity
-- from pg_tables
-- where schemaname = 'public'
--   and tablename in ('profiles','wellness_profiles','chat_sessions','chat_messages',
--                     'user_memory','knowledge_chunks','safety_rules','programs',
--                     'service_knowledge','brand_knowledge')
-- order by tablename;
-- =====================================================================
