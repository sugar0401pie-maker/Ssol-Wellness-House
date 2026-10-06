-- =====================================================================
-- SSOL Wellness House — migration: 이론 라이브러리 구조(새 테이블·칸) — 데이터는 아직 넣지 않는다
-- (Supabase SQL Editor에 전체를 붙여넣고 Run — 새 코드를 배포하기 *전에* 먼저 실행할 것)
--
-- 2026-10-06 owner 결정(이론 기반 탐색 프로젝트 v0.9): 상담 이론 14개의 라이브러리(이론·개념·기법·질문·판별 문장·
-- 이론 기반 실천·기존 실천 연결·매칭 테스트 문장)를 DB에 둔다. 이 마이그레이션은 **빈 구조만** 만들고, 데이터는
-- 이어서 scripts/import_theory_library.mjs(임베딩 포함)로 넣는다. 구조만 만들어도 앱 동작은 달라지지 않는다 —
-- 이론 기능은 THEORY_OFFER_ENABLED가 꺼져 있으면 읽히지 않고, wellness_practices의 새 칸은 기본값이라 기존 실천
-- 575개에는 영향이 없다.
--
-- 이전에 준비해 둔 20261005000000_theory_question_db.sql(실행한 적 없음)을 이 파일이 대체한다(같은 이름의 표를
-- 더 넓은 구조로 만든다). 이미 실행된 환경이어도 안전하도록 create table if not exists + add column if not exists로 썼다.
-- 여러 번 실행해도 안전하다(멱등).
-- =====================================================================

begin;

-- 1) 이론 ------------------------------------------------------------------
create table if not exists public.counseling_theories (
  theory_id          text primary key,                       -- 예: 'TH-ACT'
  internal_name      text not null,                          -- 내부용 이름. 사용자에게 노출하지 않음(선택 칩 소개 문장만 예외, 문서 D5)
  plain_focus        text not null default '',               -- 사용자에게 쓸 수 있는 쉬운 한 줄 설명
  allowed_routes     text[] not null default '{wellness,life_decision}',
  exclude_conditions text[],
  max_explore_turns  integer not null default 6,
  clinical_sensitive boolean not null default false,
  review_status      text not null default 'DRAFT',
  reviewed_by        text,
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.counseling_theories add column if not exists name_en text;
alter table public.counseling_theories add column if not exists lineage text;
alter table public.counseling_theories add column if not exists founders text;
alter table public.counseling_theories add column if not exists source_book text;
alter table public.counseling_theories add column if not exists book_type text;
alter table public.counseling_theories add column if not exists service_role text;
alter table public.counseling_theories add column if not exists domain_rank1 text;
alter table public.counseling_theories add column if not exists domain_rank2 text;
alter table public.counseling_theories add column if not exists domain_rank3 text;
alter table public.counseling_theories add column if not exists rank1_score integer;
alter table public.counseling_theories add column if not exists rank2_score integer;
alter table public.counseling_theories add column if not exists rank3_score integer;
alter table public.counseling_theories add column if not exists is_common_module boolean not null default false;
alter table public.counseling_theories add column if not exists rank_basis text;
alter table public.counseling_theories add column if not exists theory_axes text;
alter table public.counseling_theories add column if not exists prefer_other_when text;
alter table public.counseling_theories add column if not exists persona_flag text;
alter table public.counseling_theories add column if not exists voice_card jsonb;             -- {question_style, vocab, stance, forbidden}
alter table public.counseling_theories add column if not exists overlay text;
alter table public.counseling_theories add column if not exists explore_turns_typical_min integer not null default 4;
alter table public.counseling_theories add column if not exists explore_turns_typical_max integer not null default 5;
alter table public.counseling_theories add column if not exists parenting_note text;
alter table public.counseling_theories add column if not exists review_notes text;

-- 2) 심리교육 개념 ----------------------------------------------------------
create table if not exists public.theory_concepts (
  concept_id      text primary key,                          -- 예: 'ACT-C04'
  theory_id       text not null references public.counseling_theories (theory_id) on delete cascade,
  name_ko         text not null,
  name_en         text,
  definition      text,
  plain_language  text,                                      -- 일상어(왜 묻나)
  growth_frame    text,                                      -- 성장 프레임(어디로 가나) — 사용자에게 그대로 보일 수 있다
  domains_note    text,
  domains_ranked  text,
  review_status   text not null default 'DRAFT',
  reviewed_by     text,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 3) 기법(안내 수준이 서비스 게이트: chatbot_ok만 챗봇에서 사용) -----------------
create table if not exists public.theory_techniques (
  technique_id      text primary key,                        -- 예: 'ACT-T01'
  theory_id         text not null references public.counseling_theories (theory_id) on delete cascade,
  number            text,
  name              text not null,
  sub_process       text,
  domains_ranked    text,
  timing            text,
  purpose           text,
  guidance_level    text not null check (guidance_level in ('chatbot_ok', 'facilitator_only', 'excluded')),
  steps             text,
  common_mistake    text,
  homework          text,
  ui_idea           text,
  exposure_candidate text,
  example_utterances text,
  linked_practices  text,
  main_concept_id   text,
  review_status     text not null default 'DRAFT',
  reviewed_by       text,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 4) 질문(AI가 실제로 던질 말 — 원문과 채팅용을 나란히 보존) ---------------------
create table if not exists public.theory_questions (
  question_id        text primary key,                       -- 예: 'ACT-Q001'
  theory_id          text not null references public.counseling_theories (theory_id) on delete cascade,
  stage              text not null check (stage in ('OPEN', 'CLARIFY', 'REFRAME', 'COMMIT')),
  question_text      text not null,                          -- 채팅용 문장(한 번에 하나)
  intent             text,
  use_when           text,
  issue_tags         text[],
  do_not_apply_when  text[],
  order_in_stage     integer not null default 1,
  embedding          extensions.vector(1536),
  review_status      text not null default 'DRAFT',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.theory_questions add column if not exists source text;
alter table public.theory_questions add column if not exists technique_id text;
alter table public.theory_questions add column if not exists sub_process text;
alter table public.theory_questions add column if not exists question_text_original text;       -- KB 원문(검수용, AI는 쓰지 않음)
alter table public.theory_questions add column if not exists chat_enabled boolean not null default true;  -- false = 진행자 동반 등으로 챗봇 미사용
alter table public.theory_questions add column if not exists modify_note text;
alter table public.theory_questions add column if not exists concept_id text;
alter table public.theory_questions add column if not exists why_ask text;                        -- 묻는 이유(일상어)
alter table public.theory_questions add column if not exists growth_direction text;               -- 이어질 방향(성장 프레임)
alter table public.theory_questions add column if not exists reviewed_by text;
alter table public.theory_questions add column if not exists reviewed_at timestamptz;
create index if not exists theory_questions_theory_idx on public.theory_questions (theory_id, stage, order_in_stage);

-- 5) 판별 문장(사용자 말투 예시 — 이론 매칭·공감 문장·반응 확인에 쓴다) -------------
create table if not exists public.theory_signals (
  signal_id         text primary key,                        -- 예: 'ACT-S01'
  theory_id         text not null references public.counseling_theories (theory_id) on delete cascade,
  sub_process       text,
  domain            text,                                    -- 한글 영역(나 자신/커리어/연애/관계/육아/삶의 방향)
  situation         text,
  form              text,
  length_class      text,
  utterance         text not null,                           -- 사용자 말투 문장(임베딩 대상)
  reflection_text   text,                                    -- 짐작형 공감 문장(없으면 공감에 쓰지 않음)
  reflection_ok     text check (reflection_ok in ('가능', '검토', '불가')),
  memo              text,
  negative_type     text,                                    -- 부정 발언 유형 N1~N8
  negative_response text,                                    -- 북돋움 응답
  embedding         extensions.vector(1536),
  review_status     text not null default 'DRAFT',
  reviewed_by       text,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists theory_signals_theory_idx on public.theory_signals (theory_id);

-- 6) 이론 ↔ 실천 연결(궁합: fit / neutral / conflict) --------------------------
create table if not exists public.theory_practice_links (
  id                    bigint generated always as identity primary key,
  theory_id             text not null references public.counseling_theories (theory_id) on delete cascade,
  concept_or_technique  text,
  practice_id           text not null,                       -- wellness_practices.id (기존 575 또는 THX-…)
  compatibility         text not null check (compatibility in ('fit', 'neutral', 'conflict')),
  relation              text,
  basis                 text,
  review_status         text not null default 'DRAFT',
  created_at            timestamptz not null default now()
);
create index if not exists theory_practice_links_idx on public.theory_practice_links (theory_id, practice_id);

-- 7) 매칭 테스트 문장(내부용 — 임계값 보정에 쓴다) -----------------------------
create table if not exists public.matching_eval_set (
  eval_id         text primary key,
  utterance       text not null,
  expected_label  text,
  check_point     text,
  written_by      text,
  created_at      timestamptz not null default now()
);

-- 8) 실천: 이론 기반 실천용 칸(기존 575개는 기본값이라 영향 없음) ------------------
alter table public.wellness_practices add column if not exists availability text not null default 'general';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'wellness_practices_availability_check') then
    alter table public.wellness_practices
      add constraint wellness_practices_availability_check check (availability in ('general', 'after_explore'));
  end if;
end
$$;
alter table public.wellness_practices add column if not exists exposure_flag boolean not null default false;  -- 평소 피하던 감정에 다가가는 연습
alter table public.wellness_practices add column if not exists exposure_step integer;                        -- 1(가장 가벼움)~3
alter table public.wellness_practices add column if not exists coping_fit text;                              -- 1차통제/2차통제/이탈/공통(추천 순서 보조용)
alter table public.wellness_practices add column if not exists concept_id text;
alter table public.wellness_practices add column if not exists suggest_reason text;                          -- 제안 이유(사용자용 한 줄)
alter table public.wellness_practices add column if not exists source_theory_id text;
alter table public.wellness_practices add column if not exists source_technique text;
alter table public.practice_eligibility add column if not exists reviewed_by text;
alter table public.practice_eligibility add column if not exists reviewed_at timestamptz;

-- 9) 대화 상태·로그 칸 -------------------------------------------------------
alter table public.chat_sessions add column if not exists dialogue_state jsonb;
alter table public.chat_messages add column if not exists theory_id text;
alter table public.chat_messages add column if not exists dialogue_mode text;
alter table public.chat_messages add column if not exists technique_id text;
alter table public.chat_messages add column if not exists theory_chosen_by text;      -- type / discrim / conversation / default
alter table public.chat_messages add column if not exists reflection_signal_id text;
alter table public.chat_messages add column if not exists reflection_response text;   -- agree / possible_yes / partial / unsure / topic_shift / disagree

-- 10) 권한: 서버(service_role)만 읽고 쓴다 -----------------------------------------
alter table public.counseling_theories    enable row level security;
alter table public.theory_concepts        enable row level security;
alter table public.theory_techniques      enable row level security;
alter table public.theory_questions       enable row level security;
alter table public.theory_signals         enable row level security;
alter table public.theory_practice_links  enable row level security;
alter table public.matching_eval_set      enable row level security;
revoke all on public.counseling_theories, public.theory_concepts, public.theory_techniques, public.theory_questions,
              public.theory_signals, public.theory_practice_links, public.matching_eval_set from anon, authenticated;
grant select, insert, update, delete on public.counseling_theories, public.theory_concepts, public.theory_techniques,
              public.theory_questions, public.theory_signals, public.theory_practice_links, public.matching_eval_set to service_role;
grant usage, select on sequence public.theory_practice_links_id_seq to service_role;   -- 이 표의 id만(다른 표·ssol_* 객체는 건드리지 않는다)

-- 11) 검색 함수 -------------------------------------------------------------------
--   판별 문장 기준 이론 매칭: 승인된 문장·이론만, 현재 route가 허용된 이론만, 민감 이론은 기본 제외.
create or replace function public.match_theory_signals(
  query_embedding   extensions.vector(1536),
  match_count       integer          default 30,
  min_similarity    double precision default 0,
  current_route     text             default 'wellness',
  include_sensitive boolean          default false
)
returns table (
  signal_id       text,
  theory_id       text,
  sub_process     text,
  domain          text,
  reflection_text text,
  reflection_ok   text,
  similarity      double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select
    s.signal_id, s.theory_id, s.sub_process, s.domain, s.reflection_text, s.reflection_ok,
    1 - (s.embedding <=> query_embedding) as similarity
  from public.theory_signals s
  join public.counseling_theories t on t.theory_id = s.theory_id
  where s.review_status = 'APPROVED'
    and t.review_status = 'APPROVED'
    and s.embedding is not null
    and current_route = any (t.allowed_routes)
    and (include_sensitive or not t.clinical_sensitive)
    and 1 - (s.embedding <=> query_embedding) >= min_similarity
  order by s.embedding <=> query_embedding
  limit match_count
$$;

grant execute on function public.match_theory_signals(extensions.vector, integer, double precision, text, boolean)
  to service_role;

--   (이전 준비분과의 호환) 질문 임베딩 기준 검색 — 질문 임베딩이 없으면 아무것도 돌려주지 않는다.
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
    and q.chat_enabled
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

-- 확인용: 아래 한 줄이 0이면 정상(이론 데이터는 아직 안 넣음)
select count(*) as "counseling_theories 행 수 (0)" from public.counseling_theories;
