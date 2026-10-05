-- =====================================================================
-- SSOL Wellness House — migration: 상담 이론 질문 DB (준비용, 아직 실행하지 않아도 됨)
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-10-05 owner 요청: 대화 중 사용자의 고민이 어떤 상담 이론의 질문과 가까운지 찾고,
-- "행동 제안받기 / 내 고민 더 알아보기"를 고르게 하는 기능을 위한 데이터 구조.
-- 이 마이그레이션을 실행해도 THEORY_OFFER_ENABLED 환경변수가 켜져 있지 않으면 앱 동작은
-- 전혀 달라지지 않는다(코드가 이 테이블들을 읽지 않음). 질문 내용은 상담 전문가가 작성·검수한
-- 뒤 review_status='APPROVED'로 바꾼 것만 서비스된다.
--
-- 기존 knowledge_chunks(참고 자료 — AI가 지시문으로 따르지 않음)와 일부러 분리한다:
-- 이 질문들은 "AI가 실제로 던질 질문"이라 신뢰 등급과 검수 기준이 다르다.
-- =====================================================================

begin;

-- 1) 이론 (10~15행 예정) ----------------------------------------------------
create table if not exists public.counseling_theories (
  theory_id          text primary key,                 -- 예: 'TH-01'
  internal_name      text not null,                    -- 내부용 이름. 사용자에게 노출하지 않음(기본값)
  plain_focus        text not null,                    -- 사용자에게 쓸 수 있는 쉬운 한 줄 설명
  signals            text,                             -- 이 이론이 맞는 고민의 특징(검수자 메모)
  allowed_routes     text[] not null default '{wellness,life_decision}',
  exclude_conditions text[],                           -- do_not_apply_when과 같은 형식
  max_explore_turns  integer not null default 4,
  clinical_sensitive boolean not null default false,   -- true면 기본 비활성, 전문가 판단 후에만 사용
  review_status      text not null default 'DRAFT' check (review_status in ('DRAFT', 'APPROVED', 'RETIRED')),
  reviewed_by        text,
  reviewed_at        timestamptz,
  source_note        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- 2) 이론별 단계 질문 (이론당 8~12행) ---------------------------------------
create table if not exists public.theory_questions (
  question_id        text primary key,                 -- 예: 'Q-031'
  theory_id          text not null references public.counseling_theories (theory_id) on delete cascade,
  stage              text not null check (stage in ('OPEN', 'CLARIFY', 'REFRAME', 'COMMIT')),
  order_in_stage     integer not null default 1,
  question_text      text not null,                    -- 사용자에게 실제로 던질 질문(한 번에 하나)
  intent             text,                             -- 이 질문이 하려는 일(AI 가이드용 1줄, 사용자에게 안 보임)
  use_when           text,
  issue_tags         text[],
  do_not_apply_when  text[],                           -- 기존 knowledge_chunks와 같은 의미·형식
  embedding          extensions.vector(1536),          -- question_text + intent + use_when 임베딩
  review_status      text not null default 'DRAFT' check (review_status in ('DRAFT', 'APPROVED', 'RETIRED')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists theory_questions_theory_idx on public.theory_questions (theory_id, stage, order_in_stage);

-- 3) 세션 단위 대화 상태 (제안을 이미 했는지, 무엇을 골랐는지) ---------------
alter table public.chat_sessions add column if not exists dialogue_state jsonb;

comment on column public.chat_sessions.dialogue_state is
  '이론 질문 제안 흐름의 세션 상태(lib/theory/dialogueState.ts 참고). THEORY_OFFER_ENABLED가 꺼져 있으면 쓰이지 않는다.';

-- 4) 권한: 서버(service_role)만 읽고 쓴다 ------------------------------------
alter table public.counseling_theories enable row level security;
alter table public.theory_questions    enable row level security;
revoke all on public.counseling_theories from anon, authenticated;
revoke all on public.theory_questions    from anon, authenticated;
grant select, insert, update, delete on public.counseling_theories to service_role;
grant select, insert, update, delete on public.theory_questions    to service_role;

-- 5) 검색 함수: 사용자 대화와 의미가 비슷한 "승인된" 이론 질문 찾기 --------------
--   - 질문과 이론 둘 다 APPROVED여야 하고, 임베딩이 있어야 한다.
--   - allowed_routes에 현재 route가 들어 있는 이론만(임상 route는 애초에 아무것도 안 나옴).
--   - clinical_sensitive 이론은 기본 제외(include_sensitive=true일 때만).
create or replace function public.match_theory_questions(
  query_embedding   extensions.vector(1536),
  match_count       integer          default 12,
  min_similarity    double precision default 0,
  current_route     text             default 'wellness',
  include_sensitive boolean          default false
)
returns table (
  question_id       text,
  theory_id         text,
  stage             text,
  order_in_stage    integer,
  question_text     text,
  intent            text,
  do_not_apply_when text[],
  similarity        double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select
    q.question_id, q.theory_id, q.stage, q.order_in_stage,
    q.question_text, q.intent, q.do_not_apply_when,
    1 - (q.embedding <=> query_embedding) as similarity
  from public.theory_questions q
  join public.counseling_theories t on t.theory_id = q.theory_id
  where q.review_status = 'APPROVED'
    and t.review_status = 'APPROVED'
    and q.embedding is not null
    and current_route = any (t.allowed_routes)
    and (include_sensitive or not t.clinical_sensitive)
    and 1 - (q.embedding <=> query_embedding) >= min_similarity
  order by q.embedding <=> query_embedding
  limit match_count
$$;

grant execute on function public.match_theory_questions(extensions.vector, integer, double precision, text, boolean)
  to service_role;

notify pgrst, 'reload schema';

commit;
