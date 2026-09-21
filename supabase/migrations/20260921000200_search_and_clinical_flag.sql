-- =====================================================================
-- SSOL Wellness House — migration 003: 임상 chunk 표시 + 지식 검색 함수
-- (001, 002를 먼저 실행한 뒤, Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 1) knowledge_chunks.clinical_sensitive : ADHD·우울·공황 글의 chunk 표시
--      → 임상 경계 경로(route 3·4)에서만 검색하고, 사용 시 전문가 상담 안내를 붙인다.
-- 2) match_knowledge_chunks() : 질문과 의미가 비슷한 chunk를 찾는 검색 함수
--      → 서버(service role)만 호출할 수 있고, 브라우저는 호출할 수 없다.
-- 여러 번 실행해도 안전하며, 전체가 하나의 트랜잭션입니다.
-- =====================================================================

begin;

-- 1) 임상 chunk 표시 -------------------------------------------------------
alter table public.knowledge_chunks
  add column if not exists clinical_sensitive boolean not null default false;

comment on column public.knowledge_chunks.clinical_sensitive is
  'true: 임상 경계 경로에서만 사용. 이 chunk를 쓴 답변에는 전문가 상담 안내가 반드시 포함되어야 한다.';

update public.knowledge_chunks
set clinical_sensitive = true
where article_id in ('SSOL-ADHD-001', 'SSOL-DEP-001', 'SSOL-PANIC-001');

-- 2) 검색 함수 -------------------------------------------------------------
--   scope = 'general'  : 일반 chunk만 (임상 chunk 제외)  ← 일상 웰니스·인생 결정 경로
--   scope = 'clinical' : 임상 chunk만                    ← 임상 경계 경로
--   scope = 'all'      : 전부
--   그 외 값은 결과 없음(안전하게 실패)
--   비활성(is_active=false) chunk와 아직 임베딩이 없는 chunk는 항상 제외
create or replace function public.match_knowledge_chunks(
  query_embedding  extensions.vector(1536),
  match_count      integer          default 5,
  min_similarity   double precision default 0,
  scope            text             default 'general'
)
returns table (
  chunk_id            text,
  article_id          text,
  chunk_title         text,
  chunk_text          text,
  domain_tags         text[],
  issue_tags          text[],
  wellness_theme      text[],
  persona_tags        text[],
  use_when            text,
  follow_up_prompt    text,
  evidence_level      text,
  ai_attribution_rule text,
  do_not              text,
  do_not_apply_when   text[],
  priority            text,
  clinical_sensitive  boolean,
  similarity          double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select
    c.chunk_id, c.article_id, c.chunk_title, c.chunk_text,
    c.domain_tags, c.issue_tags, c.wellness_theme, c.persona_tags,
    c.use_when, c.follow_up_prompt, c.evidence_level, c.ai_attribution_rule,
    c.do_not, c.do_not_apply_when, c.priority, c.clinical_sensitive,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks c
  where c.is_active
    and c.embedding is not null
    and case scope
          when 'general'  then not c.clinical_sensitive
          when 'clinical' then c.clinical_sensitive
          when 'all'      then true
          else false
        end
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

-- 브라우저(anon/authenticated)는 호출 불가, 서버(service_role)만 가능
revoke all on function public.match_knowledge_chunks(extensions.vector, integer, double precision, text)
  from public, anon, authenticated;
grant execute on function public.match_knowledge_chunks(extensions.vector, integer, double precision, text)
  to service_role;

commit;

-- 확인용 (선택): 임상 chunk 15개가 true 로 나오면 성공
-- select article_id, count(*) filter (where clinical_sensitive) as clinical, count(*) as total
-- from public.knowledge_chunks
-- where article_id in ('SSOL-ADHD-001','SSOL-DEP-001','SSOL-PANIC-001')
-- group by article_id order by article_id;
