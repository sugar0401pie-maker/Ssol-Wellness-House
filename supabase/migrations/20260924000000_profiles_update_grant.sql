-- =====================================================================
-- SSOL Wellness House — migration: profiles 테이블에 UPDATE 권한 부여
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-09-24 실사용 중 발견한 버그: profiles_update_own이라는 RLS 정책은 001에서
-- 이미 만들어뒀지만("본인 행만 수정 가능"), 그 이전 단계인 테이블 기본 권한(GRANT)에는
-- authenticated role에게 select만 줬고 update는 준 적이 없었다. Postgres는 GRANT와
-- RLS 둘 다 통과해야 하므로, RLS는 맞아도 GRANT가 없어서 모든 업데이트가
-- "permission denied for table profiles"로 조용히 막혀 있었다 — 지금까지는 profiles를
-- 서버(service_role, RLS 우회)로만 읽고 브라우저에서 직접 수정한 적이 없어서 안 드러났다가,
-- 회원가입 화면에서 이름·생년월일을 저장하려고 하면서 발견됨.
-- 여러 번 실행해도 안전하다.
-- =====================================================================

begin;

grant update on public.profiles to authenticated;

commit;
