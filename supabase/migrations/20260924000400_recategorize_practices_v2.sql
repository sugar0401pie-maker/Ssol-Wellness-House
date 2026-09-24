-- =====================================================================
-- SSOL Wellness House — migration: 실천방법 375개를 심리테스트 v2의 5개 영역으로 재분류
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-09-24: 심리테스트가 v2로 개편되면서(final-ssol-wellness-v2-master-spec.md §3.1)
-- 영역이 "커리어/연애/관계/나 자신/삶의 방향" 5개로 정리됐다. wellness_practices의 기존
-- domain("나 자신/인간관계/연인관계·부부생활/회사·커리어/육아")도 이 5개에 맞춰 다시 이름
-- 붙인다 — id/category/tier/title/detail은 전혀 건드리지 않고 domain 값만 바꾼다.
--
-- 매핑: 나 자신→나 자신, 인간관계→관계, 연인관계·부부생활→연애, 회사·커리어→커리어,
--       육아→관계 (심리테스트 v2의 "관계" 영역 정의가 "친구·동료·가족과의 관계"로 가족을
--       명시적으로 포함하고 있어 육아를 여기로 합쳤다).
--
-- 알려진 한계: 이렇게 재분류하면 "삶의 방향" 영역에는 매칭되는 실천방법이 하나도 없다
-- (기존 5개 domain 중 "삶의 방향"에 해당하는 게 원래 없었음). 온보딩/일일 제안 로직은
-- 정확히 일치하는 domain이 없으면 전체 목록으로 자연스럽게 fallback하도록 이미 만들어
-- 놨지만(lib/rag/practicesSearch.ts), "삶의 방향" 전용 콘텐츠를 나중에 추가하면 더 좋다.
-- 여러 번 실행해도 안전하다(멱등 — 이미 새 이름이면 조건에 안 걸려 그대로 둠).
-- =====================================================================

begin;

update public.wellness_practices set domain = '관계'   where domain = '인간관계';
update public.wellness_practices set domain = '연애'   where domain = '연인관계·부부생활';
update public.wellness_practices set domain = '커리어' where domain = '회사·커리어';
update public.wellness_practices set domain = '관계'   where domain = '육아';
-- '나 자신'은 이름이 그대로라 손댈 것 없음.

commit;
