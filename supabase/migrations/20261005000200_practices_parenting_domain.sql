-- =====================================================================
-- SSOL Wellness House — migration: 육아 실천방법을 '관계'에서 다시 '육아' 영역으로 분리
-- (Supabase SQL Editor에 전체를 붙여넣고 Run — 새 코드를 배포하기 *전에* 먼저 실행할 것)
--
-- 2026-10-05 owner 결정: 20260924000400에서 육아를 '관계'로 합쳤지만, 육아는 따로 떼어
-- '육아' 영역으로 둔다. id가 PARENT-* (원본 75개) 와 NEW-PARENT-* (신규 40개)인 115개 행의
-- domain만 '육아'로 바꾼다 — id/category/tier/title/detail 등 다른 값은 건드리지 않는다.
-- (기존 domain 값이 아니라 id 접두사로 고르므로, 이미 실행했어도 결과가 같다.)
-- 실행 후: 관계 115개(REL-*, NEW-REL-*), 육아 115개.
-- 여러 번 실행해도 안전하다(멱등).
-- =====================================================================

begin;

update public.wellness_practices
   set domain = '육아'
 where (id like 'PARENT-%' or id like 'NEW-PARENT-%')
   and domain is distinct from '육아';

commit;
