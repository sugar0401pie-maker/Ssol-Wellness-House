-- =====================================================================
-- SSOL Wellness House — migration: wellness_practices에 콘텐츠 파이프라인 태그 컬럼 추가
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-09-28 owner 요청: owner의 콘텐츠 파이프라인은 7개 태그(#CORE #CALM #PERFECT #HAPPY
-- #COMPASS #LOVE #RESILIENCE)로 운영되는데, 이 중 어디에도 대응하지 않는 "PARENT(육아)"
-- 영역 115건이 있다는 게 SSOL_575_Practices_Pipeline_Aligned_v1 검토에서 드러났다(문서
-- 4장). owner가 PARENT를 8번째 태그로 신설하기로 결정 — 이 컬럼은 그 8개 태그 값을 담는다.
-- 값은 데이터로만 채우고(scripts/update_practices_tags.mjs), 앱 로직은 아직 이 컬럼을
-- 참조하지 않는다(향후 AI 채팅 참고자료로 쓸지는 별도 결정 사항, CLAUDE.md 참고).
-- 여러 번 실행해도 안전하다.
-- =====================================================================

begin;

alter table public.wellness_practices
  add column if not exists pipeline_tag text;

comment on column public.wellness_practices.pipeline_tag is
  '콘텐츠 파이프라인 8개 태그 중 하나(CORE/CALM/PERFECT/HAPPY/COMPASS/LOVE/RESILIENCE/PARENT), 없으면 null. 현재는 분류용 데이터일 뿐 앱 로직이 참조하지 않는다.';

commit;
