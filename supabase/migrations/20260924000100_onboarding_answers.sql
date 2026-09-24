-- =====================================================================
-- SSOL Wellness House — migration: 온보딩(자기소개) 답변 저장
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-09-24: 로그인 후 처음 접속하면 "즐거움을 느끼는 부분"·"주요 고민거리"를 물어보고,
-- 그 답을 홈 탭의 "오늘의 실천방법" 개인화(wellness_practices의 category/domain 매칭)에
-- 쓴다. 진단이나 안전 판단에는 쓰지 않는다(SAFE-005와 같은 이유로 개인화 전용).
-- 여러 번 실행해도 안전하다.
-- =====================================================================

begin;

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists enjoyment_category text,
  add column if not exists concern_domain text,
  add column if not exists concern_other text;

comment on column public.profiles.onboarding_completed_at is
  '로그인 후 첫 "자기소개" 질문에 답한 시각. null이면 아직 안 함 — 그동안 앱 진입 시 온보딩 팝업을 먼저 보여준다.';
comment on column public.profiles.enjoyment_category is
  '"주로 즐거움을 느끼는 부분" 답변을 wellness_practices.category 중 하나로 매핑한 값(개인화 전용, lib/onboarding/mappings.ts 참고).';
comment on column public.profiles.concern_domain is
  '"주요 고민거리" 답변을 wellness_practices.domain 중 하나로 매핑한 값(개인화 전용).';
comment on column public.profiles.concern_other is
  '고민거리로 "기타"를 골랐을 때 직접 작성한 텍스트(참고용, domain 매핑에는 안 씀).';

commit;
