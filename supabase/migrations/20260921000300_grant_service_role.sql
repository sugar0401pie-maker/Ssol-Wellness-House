-- =====================================================================
-- SSOL Wellness House — migration 004: 서버 키(service_role)에 우리 테이블 권한 부여
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 이 프로젝트는 새 테이블에 서버 키 권한을 자동으로 주지 않아서,
-- 서버가 우리 테이블을 읽고 쓰려면 명시적으로 권한을 줘야 합니다.
--
-- * 이름을 하나하나 적은 우리 테이블에만 적용합니다.
--   (같은 프로젝트에 있는 ssol_* 테이블 = 다른 앱의 데이터는 건드리지 않습니다)
-- * 아직 없는 테이블은 건너뜁니다.
-- * 브라우저 키(anon/authenticated) 권한은 바꾸지 않습니다.
-- * 여러 번 실행해도 안전합니다.
-- =====================================================================

begin;

grant usage on schema public to service_role;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'wellness_profiles', 'chat_sessions', 'chat_messages', 'user_memory',
    'knowledge_chunks', 'safety_rules', 'programs', 'service_knowledge', 'brand_knowledge',
    'articles', 'frameworks', 'question_library', 'taxonomy', 'system_prompt_sections',
    'source_policy', 'response_routes', 'app_config', 'program_routing_rules', 'session_examples'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('grant select, insert, update, delete on public.%I to service_role', t);
      raise notice '권한 부여: %', t;
    else
      raise notice '건너뜀(테이블 없음): %', t;
    end if;
  end loop;
end
$$;

-- 검색 함수 실행 권한 (003에서 이미 부여했지만 안전하게 한 번 더)
grant execute on function public.match_knowledge_chunks(extensions.vector, integer, double precision, text)
  to service_role;

-- API가 변경을 바로 인식하도록 새로고침
notify pgrst, 'reload schema';

commit;

-- ---------------------------------------------------------------------
-- 진단용 (선택, 결과를 알려주세요): 'chat' 이 들어간 테이블과 우리 핵심 테이블 존재 여부
-- select table_name from information_schema.tables
-- where table_schema = 'public' and (table_name like '%chat%' or table_name in ('profiles','ssol_profiles'))
-- order by table_name;
-- ---------------------------------------------------------------------
