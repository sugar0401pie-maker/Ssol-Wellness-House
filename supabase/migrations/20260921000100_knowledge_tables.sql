-- =====================================================================
-- SSOL Wellness House — migration 002: 나머지 지식 테이블
-- (001을 먼저 실행한 뒤, Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- Excel의 나머지 시트를 담을 테이블을 만들고, knowledge_chunks.article_id를
-- articles에 연결(FK)합니다. 001과 마찬가지로:
--   * 여러 번 실행해도 안전 (idempotent)
--   * 전체가 하나의 트랜잭션 (오류 시 아무것도 만들어지지 않음)
--   * 모든 테이블 RLS 켬 + 브라우저(anon/authenticated) 접근 차단 (서버 전용)
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- articles — 글 메타데이터 (원문 전체는 저장하지 않음)
-- ---------------------------------------------------------------------
create table if not exists public.articles (
  article_id            text primary key,
  title                 text not null,
  author                text,
  source_type           text not null,
  primary_domain        text[],
  primary_issues        text[],
  wellness_themes       text[],
  evidence_status       text not null,
  priority              text,
  persona_tags          text[],
  human_handoff_summary text,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- knowledge_chunks.article_id → articles (아직 연결 전이면 연결)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'knowledge_chunks_article_id_fkey'
      and conrelid = 'public.knowledge_chunks'::regclass
  ) then
    alter table public.knowledge_chunks
      add constraint knowledge_chunks_article_id_fkey
      foreign key (article_id) references public.articles (article_id);
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- frameworks / question_library
-- ---------------------------------------------------------------------
create table if not exists public.frameworks (
  framework_id       text primary key,
  framework_name     text not null,
  purpose            text,
  steps              jsonb not null,      -- ["1) ...", "2) ..."] 순서 유지
  trigger_examples   text[],
  linked_article_ids text[],
  persona_tags       text[],
  usage_rule         text,
  priority           text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.question_library (
  question_id    text primary key,
  framework_id   text references public.frameworks (framework_id),
  domain         text[],
  issue_tags     text[],
  wellness_theme text[],
  question_text  text not null,
  use_when       text,
  avoid_when     text[],
  persona_tags   text[],
  priority       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- taxonomy — 태그/유형 코드표
-- ---------------------------------------------------------------------
create table if not exists public.taxonomy (
  type        text not null,
  code        text not null,
  label_ko    text not null,
  description text,
  examples    text[],
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (type, code)
);

-- ---------------------------------------------------------------------
-- system_prompt_sections / source_policy / response_routes / app_config
-- ---------------------------------------------------------------------
create table if not exists public.system_prompt_sections (
  section_id          text primary key,
  section_order       integer not null,
  section_name        text not null,
  prompt_text         text not null,
  priority            text not null,   -- Critical 섹션은 RAG가 덮어쓸 수 없음
  implementation_note text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.source_policy (
  level            integer primary key,
  source_class     text not null,
  examples         text,
  allowed_use      text not null,
  attribution_rule text,
  medical_use      text,
  numerical_claims text,
  priority         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.response_routes (
  route_order        integer primary key,   -- 작을수록 우선
  intent_or_trigger  text not null,
  precheck           text,
  retrieval_scope    text not null,
  top_k              integer,
  required_policy    text[] not null,
  response_mode      text not null,
  human_handoff      text,
  program_route      text,
  forbidden          text[],
  example_output_goal text,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.app_config (
  config_key          text primary key,
  value               text not null,
  type                text,
  description         text,
  implementation_note text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- program_routing_rules / session_examples
-- ---------------------------------------------------------------------
create table if not exists public.program_routing_rules (
  route_id             text primary key,
  user_signal          text[] not null,
  primary_program_id   text not null references public.programs (program_id),
  secondary_program_id text references public.programs (program_id),
  confidence_rule      text,
  safety_precheck      text not null,   -- 추천 전에 반드시 실행
  suggestion_language  text,
  do_not               text,
  priority             text,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.session_examples (
  case_id               text primary key,
  program_id            text not null references public.programs (program_id),
  case_title            text not null,
  presenting_concern    text,
  initial_context       text,
  session_flow          text[],
  session_goal          text,
  key_insights          text,
  behavioral_experiments text[],
  outcome_example       text,
  fictional_flag        boolean not null check (fictional_flag = true),  -- 가상 사례만 허용 (SAFE-017)
  ai_usage_rule         text not null,
  do_not                text[],
  clinical_flag         text,
  source_note           text,
  priority              text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.session_examples is
  '모든 사례는 여러 사례를 조합한 가상 예시. 과정 설명에만 사용하며 효능 증거로 쓰지 않는다 (SAFE-017).';

-- ---------------------------------------------------------------------
-- updated_at 자동 갱신 트리거 (set_updated_at 함수는 001에서 생성됨)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'articles', 'frameworks', 'question_library', 'taxonomy',
    'system_prompt_sections', 'source_policy', 'response_routes', 'app_config',
    'program_routing_rules', 'session_examples'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- 보안: RLS 켜고 브라우저 권한 회수 (정책 없음 → 서버 전용)
-- ---------------------------------------------------------------------
alter table public.articles               enable row level security;
alter table public.frameworks             enable row level security;
alter table public.question_library       enable row level security;
alter table public.taxonomy               enable row level security;
alter table public.system_prompt_sections enable row level security;
alter table public.source_policy          enable row level security;
alter table public.response_routes        enable row level security;
alter table public.app_config             enable row level security;
alter table public.program_routing_rules  enable row level security;
alter table public.session_examples       enable row level security;

revoke all on public.articles, public.frameworks, public.question_library,
              public.taxonomy, public.system_prompt_sections, public.source_policy,
              public.response_routes, public.app_config,
              public.program_routing_rules, public.session_examples
  from anon, authenticated;

commit;

-- 확인용 (선택): 새 테이블 10개가 rowsecurity = true 로 보이면 성공
-- select tablename, rowsecurity from pg_tables
-- where schemaname = 'public'
--   and tablename in ('articles','frameworks','question_library','taxonomy',
--                     'system_prompt_sections','source_policy','response_routes',
--                     'app_config','program_routing_rules','session_examples')
-- order by tablename;
