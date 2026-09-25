-- =====================================================================
-- SSOL Wellness House -- migration: 온보딩 Q8(daily_time)을 복수 선택으로 변경
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-09-25 owner 요청: "하루에 낼 수 있는 시간"은 상황에 따라 여러 개 해당할 수 있어
-- 단일 선택 -> 복수 선택으로 바꾼다. 컬럼 타입을 text -> text[]로 바꾼다.
-- 기존에 저장된 단일 값(text)이 있다면 그 값 하나짜리 배열로 옮겨서 데이터를 보존한다.
-- (Q7 focus_domains의 2개 제한 제거는 컬럼 타입 변경 없이 애플리케이션 코드에서만
-- 처리했다 -- 이미 text[] 컬럼이라 여기서 손댈 것 없음.)
-- 여러 번 실행해도 안전하다.
-- =====================================================================

begin;

alter table public.user_onboarding
  alter column daily_time type text[]
  using (case when daily_time is null then null else array[daily_time] end);

commit;
