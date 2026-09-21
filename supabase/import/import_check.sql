-- =====================================================================
-- SSOL import 확인 — 행 개수 (예상 개수와 비교)
-- 자동 생성 파일입니다 (scripts/build_import_sql.pl). 직접 수정하지 마세요.
-- Supabase SQL Editor에 전체를 붙여넣고 Run 하세요. 여러 번 실행해도 안전합니다(upsert).
-- 전체가 하나의 트랜잭션이라 오류가 나면 아무것도 저장되지 않습니다.
-- =====================================================================

select 'articles' as table_name, count(*) as rows from public.articles
union all select 'frameworks', count(*) from public.frameworks
union all select 'question_library', count(*) from public.question_library
union all select 'taxonomy', count(*) from public.taxonomy
union all select 'system_prompt_sections', count(*) from public.system_prompt_sections
union all select 'safety_rules', count(*) from public.safety_rules
union all select 'source_policy', count(*) from public.source_policy
union all select 'programs', count(*) from public.programs
union all select 'program_routing_rules', count(*) from public.program_routing_rules
union all select 'session_examples', count(*) from public.session_examples
union all select 'service_knowledge', count(*) from public.service_knowledge
union all select 'brand_knowledge', count(*) from public.brand_knowledge
union all select 'response_routes', count(*) from public.response_routes
union all select 'app_config', count(*) from public.app_config
union all select 'knowledge_chunks', count(*) from public.knowledge_chunks
order by 1;

-- 예상 개수:
--   app_config               13
--   articles                 19
--   brand_knowledge          8
--   frameworks               11
--   knowledge_chunks         82
--   program_routing_rules    5
--   programs                 5
--   question_library         28
--   response_routes          7
--   safety_rules             17
--   service_knowledge        9
--   session_examples         5
--   source_policy            7
--   system_prompt_sections   13
--   taxonomy                 40

-- 임베딩 대기 중인 chunk (M3 전에는 전부 대기가 정상):
-- select count(*) filter (where embedding is null) as waiting, count(*) filter (where is_active) as active, count(*) as total from public.knowledge_chunks;
