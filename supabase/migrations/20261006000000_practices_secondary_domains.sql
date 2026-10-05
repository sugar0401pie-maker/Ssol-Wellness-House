-- =====================================================================
-- SSOL Wellness House — migration: 실천방법에 "2순위 영역" 칸 추가 + '삶의 방향' 2순위 30개 지정
-- (Supabase SQL Editor에 전체를 붙여넣고 Run — 새 코드를 배포하기 *전에* 먼저 실행할 것)
--
-- 2026-10-06 owner 결정(B-라이트): wellness_practices.domain은 그대로 "1순위 영역"으로 두고,
-- 순서 있는 목록 칸 secondary_domains를 "2순위·3순위…" 영역으로 추가한다.
-- 예) '이 일이 나에게 어떤 의미인지 주기적으로 확인하기' = 1순위 커리어, 2순위 삶의 방향.
-- 이 칸은 "실천이 어느 주제 영역인가"의 분류이고, 온보딩 답으로 점수를 매기는 개인화 태그
-- (practice_eligibility.q7_focus_codes 등)와는 별개다 — 이 마이그레이션은 그 태그를 건드리지 않는다.
--
-- 지금까지 '삶의 방향'이 1순위인 실천은 0개였다. 그래서 내용을 보고 고른 30개를 2순위로 지정한다
-- (가볍게 시작 7 / 꾸준히 이어가기 12 / 장기 습관 11). 1순위 domain·조건표·id·제목·설명 등은 전혀 바꾸지 않는다.
-- 목록을 바꾸고 싶으면 아래 ARRAY 안의 id만 고쳐서 다시 실행하면 된다(여러 번 실행해도 안전, 아래 설명 참고).
--
-- 실행 후 맨 아래 확인용 조회 결과가 30이어야 한다.
-- =====================================================================

begin;

alter table public.wellness_practices
  add column if not exists secondary_domains text[] not null default '{}';

comment on column public.wellness_practices.secondary_domains is
  '2순위·3순위 영역(순서가 곧 순위). domain이 1순위. 개인화 태그(practice_eligibility)와는 별개의 분류.';

-- 이 마이그레이션이 지정하는 "삶의 방향" 2순위 목록. 다시 실행하면 이 목록 기준으로 맞춰진다:
-- 목록에 없는 행의 '삶의 방향'은 빼고, 목록에 있는 행은 넣는다(다른 2순위 값이 있으면 그대로 둔다).
with picked(id) as (
  select unnest(array[
    -- 가볍게 시작 (7)
    'NEW-SELF-VALUES-02', 'NEW-SELF-VALUES-06', 'NEW-SELF-VALUES-10',
    'SELF-HELP-L1-01', 'NEW-SELF-CREATE-09', 'NEW-WORK-LEARN-05', 'NEW-WORK-CONTEXT-09',
    -- 꾸준히 이어가기 (12)
    'NEW-SELF-VALUES-01', 'NEW-SELF-VALUES-03', 'NEW-SELF-VALUES-04', 'NEW-SELF-VALUES-05',
    'NEW-SELF-VALUES-07', 'NEW-SELF-VALUES-08', 'SELF-HELP-L2-03',
    'WORK-MIND-L2-03', 'WORK-MIND-L2-05', 'NEW-WORK-LEARN-02', 'NEW-WORK-LEARN-09', 'NEW-WORK-LEARN-10',
    -- 장기 습관·정체성으로 (11)
    'SELF-MIND-L3-04', 'SELF-MIND-L3-01', 'SELF-MIND-L3-05', 'SELF-BODY-L3-02', 'SELF-HELP-L3-03',
    'WORK-MIND-L3-02', 'WORK-MIND-L3-03', 'WORK-MIND-L3-05', 'WORK-CARE-L3-04', 'WORK-CARE-L3-02',
    'WORK-HELP-L3-02'
  ])
)
update public.wellness_practices p
   set secondary_domains = case
         when p.id in (select id from picked)
           then array_append(array_remove(p.secondary_domains, '삶의 방향'), '삶의 방향')
         else array_remove(p.secondary_domains, '삶의 방향')
       end
 where (p.id in (select id from picked) and not ('삶의 방향' = any (p.secondary_domains)))
    or (p.id not in (select id from picked) and '삶의 방향' = any (p.secondary_domains));

commit;

-- 확인용: 30이어야 한다.
select count(*) as "삶의 방향 2순위 개수 (30이어야 함)"
  from public.wellness_practices
 where '삶의 방향' = any (secondary_domains);
