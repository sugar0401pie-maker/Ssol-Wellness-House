-- =====================================================================
-- SSOL Wellness House — migration: 통합본(SSOL_Practices_Unified_v1.0) 중 '기존 575개'에 대한 반영 사항
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-10-06 owner 승인 사항(통합본 보완 목록 1·5·6번 + 3번 중 서비스 중인 1건):
--   1) 제목: 통합본 제목으로 통일 승인. 단 39개 중 27개는 DB가 이미 9/28 v2에서 다시 쓴 제목(통합본은 v2 이전 문구
--      기준이라 되돌림이 될 수 있음)이라 이 파일에서는 보류하고, DB가 아직 옛 문구인 12개만 반영한다.
--   2) tier 157개 변경 반영("다 반영"): 꾸준히 이어가기→가볍게 시작 155개, 가볍게 시작→꾸준히 이어가기 2개
--      → 홈 '오늘의 실천' 후보(가볍게 시작)가 155개에서 308개로 늘어난다.
--   3) 통합본이 새로 붙인 '삶의 방향' 2순위 19개 추가(기존 30개는 그대로) → 합계 49개
--   4) 숫자%가 들어가 출력 검사에 걸리는 서비스 중 실천 1건의 제목 문구 수정(WORK-MIND-L2-02, 100% → 완벽)
-- 설명(detail)은 건드리지 않는다 — 9/28에 반영한 v2 설명을 그대로 유지한다(통합본의 옛 설명으로 되돌리지 않음).
-- 다른 컬럼·다른 테이블(practice_eligibility 포함)도 건드리지 않는다. 여러 번 실행해도 안전하다(멱등).
-- =====================================================================

begin;

-- 1) 제목 12개 — DB 제목이 아직 옛 v1.2 문구(어색한 문장)인 것만, 통합본의 고친 제목으로 교체
--    (나머지 27개는 DB가 이미 9/28 v2에서 다시 쓴 제목이라 owner 재확인 후 별도로 결정 — 아래 헤더 참고)
update public.wellness_practices w
   set title = v.title
  from (values
    ('SELF-TALK-L3-01', '에너지를 빼앗는 관계와의 만남을 서서히 줄이기'),
    ('SELF-CARE-L3-01', '수면·식사·운동, 세 가지 기본을 꾸준히 챙기는 습관 만들기'),
    ('SELF-HELP-L1-03', '혼자 끌어안지 않고 힘들다는 것부터 주변에 알리기'),
    ('SELF-HELP-L2-04', '도움을 청하는 것도 능력이라고 여기는 연습하기'),
    ('REL-CARE-L1-03', '모든 초대에 응하지 않아도 괜찮다고 여기는 연습하기'),
    ('REL-CARE-L2-05', '매주 사람 만나는 시간과 혼자 쉬는 시간을 의식적으로 나누기'),
    ('COUPLE-TALK-L2-03', '관계가 편해질수록 서로의 마음을 더 자주 확인하기'),
    ('WORK-TALK-L3-05', '혼자 애쓰지 않고 원하는 방향을 주변에 알리기'),
    ('WORK-HELP-L3-01', '필요하면 전문가 도움이나 구조적 변화를 고려하기'),
    ('PARENT-TALK-L2-02', '생각이 다른 부분을 정기적으로 조율하기'),
    ('NEW-SELF-VALUES-08', '지금은 좇지 않아도 될 목표 하나 내려놓기'),
    ('NEW-WORK-TRANSITION-04', '업무가 끝나면 화면 배경 바꾸기')
  ) as v(id, title)
 where w.id = v.id
   and w.title is distinct from v.title;

-- 2) tier 157개
update public.wellness_practices w
   set tier = v.tier
  from (values
    ('NEW-SELF-SENSE-01', '가볍게 시작'),
    ('NEW-SELF-SENSE-02', '가볍게 시작'),
    ('NEW-SELF-SENSE-04', '가볍게 시작'),
    ('NEW-SELF-SENSE-05', '가볍게 시작'),
    ('NEW-SELF-SENSE-06', '가볍게 시작'),
    ('NEW-SELF-SENSE-07', '가볍게 시작'),
    ('NEW-SELF-SENSE-08', '가볍게 시작'),
    ('NEW-SELF-SENSE-10', '가볍게 시작'),
    ('NEW-SELF-CREATE-01', '가볍게 시작'),
    ('NEW-SELF-CREATE-02', '가볍게 시작'),
    ('NEW-SELF-CREATE-03', '가볍게 시작'),
    ('NEW-SELF-CREATE-04', '가볍게 시작'),
    ('NEW-SELF-CREATE-05', '가볍게 시작'),
    ('NEW-SELF-CREATE-06', '가볍게 시작'),
    ('NEW-SELF-CREATE-07', '가볍게 시작'),
    ('NEW-SELF-CREATE-08', '가볍게 시작'),
    ('NEW-SELF-CREATE-09', '가볍게 시작'),
    ('NEW-SELF-CREATE-10', '가볍게 시작'),
    ('NEW-SELF-REST-01', '가볍게 시작'),
    ('NEW-SELF-REST-02', '가볍게 시작'),
    ('NEW-SELF-REST-03', '가볍게 시작'),
    ('NEW-SELF-REST-06', '가볍게 시작'),
    ('NEW-SELF-REST-07', '가볍게 시작'),
    ('NEW-SELF-REST-08', '가볍게 시작'),
    ('NEW-SELF-REST-09', '가볍게 시작'),
    ('NEW-SELF-REST-10', '가볍게 시작'),
    ('NEW-SELF-VALUES-01', '가볍게 시작'),
    ('NEW-SELF-VALUES-03', '가볍게 시작'),
    ('NEW-SELF-VALUES-04', '가볍게 시작'),
    ('NEW-SELF-VALUES-05', '가볍게 시작'),
    ('NEW-SELF-VALUES-07', '가볍게 시작'),
    ('NEW-SELF-VALUES-08', '가볍게 시작'),
    ('NEW-SELF-VALUES-09', '가볍게 시작'),
    ('NEW-REL-ASYNC-01', '가볍게 시작'),
    ('NEW-REL-ASYNC-02', '가볍게 시작'),
    ('NEW-REL-ASYNC-03', '가볍게 시작'),
    ('NEW-REL-ASYNC-04', '가볍게 시작'),
    ('NEW-REL-ASYNC-06', '가볍게 시작'),
    ('NEW-REL-ASYNC-07', '가볍게 시작'),
    ('NEW-REL-ASYNC-08', '가볍게 시작'),
    ('NEW-REL-ASYNC-09', '가볍게 시작'),
    ('NEW-REL-ASYNC-10', '가볍게 시작'),
    ('NEW-REL-SHARED-01', '가볍게 시작'),
    ('NEW-REL-SHARED-02', '가볍게 시작'),
    ('NEW-REL-SHARED-05', '가볍게 시작'),
    ('NEW-REL-SHARED-06', '가볍게 시작'),
    ('NEW-REL-SHARED-07', '가볍게 시작'),
    ('NEW-REL-SHARED-08', '가볍게 시작'),
    ('NEW-REL-SHARED-09', '가볍게 시작'),
    ('NEW-REL-SHARED-10', '가볍게 시작'),
    ('NEW-REL-BOUNDARY-02', '가볍게 시작'),
    ('NEW-REL-BOUNDARY-03', '가볍게 시작'),
    ('NEW-REL-BOUNDARY-04', '가볍게 시작'),
    ('NEW-REL-BOUNDARY-05', '가볍게 시작'),
    ('NEW-REL-BOUNDARY-06', '가볍게 시작'),
    ('NEW-REL-BOUNDARY-09', '가볍게 시작'),
    ('NEW-REL-NEW-01', '가볍게 시작'),
    ('NEW-REL-NEW-02', '가볍게 시작'),
    ('NEW-REL-NEW-04', '가볍게 시작'),
    ('NEW-REL-NEW-05', '가볍게 시작'),
    ('NEW-REL-NEW-06', '가볍게 시작'),
    ('NEW-REL-NEW-07', '가볍게 시작'),
    ('NEW-REL-NEW-08', '가볍게 시작'),
    ('NEW-REL-NEW-09', '가볍게 시작'),
    ('NEW-REL-NEW-10', '가볍게 시작'),
    ('NEW-COUPLE-PLAY-01', '가볍게 시작'),
    ('NEW-COUPLE-PLAY-02', '가볍게 시작'),
    ('NEW-COUPLE-PLAY-04', '가볍게 시작'),
    ('NEW-COUPLE-PLAY-05', '가볍게 시작'),
    ('NEW-COUPLE-PLAY-06', '가볍게 시작'),
    ('NEW-COUPLE-PLAY-07', '가볍게 시작'),
    ('NEW-COUPLE-PLAY-08', '가볍게 시작'),
    ('NEW-COUPLE-PLAY-09', '가볍게 시작'),
    ('NEW-COUPLE-PLAY-10', '가볍게 시작'),
    ('NEW-COUPLE-CHECKIN-01', '가볍게 시작'),
    ('NEW-COUPLE-CHECKIN-02', '가볍게 시작'),
    ('NEW-COUPLE-CHECKIN-03', '가볍게 시작'),
    ('NEW-COUPLE-CHECKIN-04', '가볍게 시작'),
    ('NEW-COUPLE-CHECKIN-05', '가볍게 시작'),
    ('NEW-COUPLE-CHECKIN-06', '가볍게 시작'),
    ('NEW-COUPLE-CHECKIN-07', '가볍게 시작'),
    ('NEW-COUPLE-CHECKIN-09', '가볍게 시작'),
    ('NEW-COUPLE-FUTURE-01', '가볍게 시작'),
    ('NEW-COUPLE-FUTURE-02', '가볍게 시작'),
    ('NEW-COUPLE-FUTURE-04', '가볍게 시작'),
    ('NEW-COUPLE-FUTURE-06', '가볍게 시작'),
    ('NEW-COUPLE-FUTURE-07', '가볍게 시작'),
    ('NEW-COUPLE-FUTURE-08', '가볍게 시작'),
    ('NEW-COUPLE-FUTURE-09', '가볍게 시작'),
    ('NEW-COUPLE-CARE-01', '가볍게 시작'),
    ('NEW-COUPLE-CARE-02', '가볍게 시작'),
    ('NEW-COUPLE-CARE-03', '가볍게 시작'),
    ('NEW-COUPLE-CARE-04', '가볍게 시작'),
    ('NEW-COUPLE-CARE-06', '가볍게 시작'),
    ('NEW-COUPLE-CARE-07', '가볍게 시작'),
    ('NEW-COUPLE-CARE-08', '가볍게 시작'),
    ('NEW-COUPLE-CARE-09', '가볍게 시작'),
    ('NEW-COUPLE-CARE-10', '가볍게 시작'),
    ('NEW-WORK-FOCUS-01', '가볍게 시작'),
    ('NEW-WORK-FOCUS-02', '가볍게 시작'),
    ('NEW-WORK-FOCUS-03', '가볍게 시작'),
    ('NEW-WORK-FOCUS-04', '가볍게 시작'),
    ('NEW-WORK-FOCUS-05', '가볍게 시작'),
    ('NEW-WORK-FOCUS-06', '가볍게 시작'),
    ('NEW-WORK-FOCUS-07', '가볍게 시작'),
    ('NEW-WORK-FOCUS-10', '가볍게 시작'),
    ('NEW-WORK-LEARN-01', '가볍게 시작'),
    ('NEW-WORK-LEARN-02', '가볍게 시작'),
    ('NEW-WORK-LEARN-03', '가볍게 시작'),
    ('NEW-WORK-LEARN-04', '가볍게 시작'),
    ('NEW-WORK-LEARN-05', '꾸준히 이어가기'),
    ('NEW-WORK-LEARN-06', '가볍게 시작'),
    ('NEW-WORK-LEARN-07', '가볍게 시작'),
    ('NEW-WORK-LEARN-08', '가볍게 시작'),
    ('NEW-WORK-LEARN-09', '가볍게 시작'),
    ('NEW-WORK-LEARN-10', '가볍게 시작'),
    ('NEW-WORK-TRANSITION-01', '가볍게 시작'),
    ('NEW-WORK-TRANSITION-05', '가볍게 시작'),
    ('NEW-WORK-TRANSITION-07', '가볍게 시작'),
    ('NEW-WORK-TRANSITION-08', '가볍게 시작'),
    ('NEW-WORK-CONTEXT-01', '가볍게 시작'),
    ('NEW-WORK-CONTEXT-02', '가볍게 시작'),
    ('NEW-WORK-CONTEXT-06', '가볍게 시작'),
    ('NEW-WORK-CONTEXT-08', '가볍게 시작'),
    ('NEW-WORK-CONTEXT-10', '가볍게 시작'),
    ('NEW-PARENT-PLAY-01', '가볍게 시작'),
    ('NEW-PARENT-PLAY-02', '가볍게 시작'),
    ('NEW-PARENT-PLAY-03', '가볍게 시작'),
    ('NEW-PARENT-PLAY-04', '가볍게 시작'),
    ('NEW-PARENT-PLAY-05', '가볍게 시작'),
    ('NEW-PARENT-PLAY-06', '가볍게 시작'),
    ('NEW-PARENT-PLAY-07', '가볍게 시작'),
    ('NEW-PARENT-PLAY-08', '가볍게 시작'),
    ('NEW-PARENT-PLAY-09', '가볍게 시작'),
    ('NEW-PARENT-PLAY-10', '가볍게 시작'),
    ('NEW-PARENT-TALK-02', '가볍게 시작'),
    ('NEW-PARENT-TALK-03', '가볍게 시작'),
    ('NEW-PARENT-TALK-04', '가볍게 시작'),
    ('NEW-PARENT-TALK-05', '가볍게 시작'),
    ('NEW-PARENT-TALK-06', '가볍게 시작'),
    ('NEW-PARENT-TALK-07', '가볍게 시작'),
    ('NEW-PARENT-TALK-08', '꾸준히 이어가기'),
    ('NEW-PARENT-TALK-10', '가볍게 시작'),
    ('NEW-PARENT-ROUTINE-04', '가볍게 시작'),
    ('NEW-PARENT-ROUTINE-05', '가볍게 시작'),
    ('NEW-PARENT-ROUTINE-06', '가볍게 시작'),
    ('NEW-PARENT-ROUTINE-07', '가볍게 시작'),
    ('NEW-PARENT-ROUTINE-08', '가볍게 시작'),
    ('NEW-PARENT-SUPPORT-01', '가볍게 시작'),
    ('NEW-PARENT-SUPPORT-02', '가볍게 시작'),
    ('NEW-PARENT-SUPPORT-03', '가볍게 시작'),
    ('NEW-PARENT-SUPPORT-04', '가볍게 시작'),
    ('NEW-PARENT-SUPPORT-05', '가볍게 시작'),
    ('NEW-PARENT-SUPPORT-06', '가볍게 시작'),
    ('NEW-PARENT-SUPPORT-07', '가볍게 시작'),
    ('NEW-PARENT-SUPPORT-08', '가볍게 시작'),
    ('NEW-PARENT-SUPPORT-09', '가볍게 시작')
  ) as v(id, tier)
 where w.id = v.id
   and w.tier is distinct from v.tier;

-- 3) '삶의 방향' 2순위 19개 추가(이미 있으면 그대로)
update public.wellness_practices w
   set secondary_domains = array_append(w.secondary_domains, '삶의 방향')
 where w.id in (
    'SELF-HELP-L2-05', 'REL-MIND-L3-02', 'REL-TALK-L3-02', 'COUPLE-BODY-L3-04', 'COUPLE-MIND-L3-02', 'COUPLE-MIND-L3-05', 'COUPLE-TALK-L2-05', 'COUPLE-HELP-L3-04', 'WORK-BODY-L3-04', 'WORK-MIND-L3-04', 'WORK-CARE-L3-03', 'WORK-CARE-L3-05', 'WORK-HELP-L3-03', 'PARENT-MIND-L3-02', 'PARENT-MIND-L3-04', 'PARENT-CARE-L3-02', 'NEW-SELF-VALUES-09', 'NEW-COUPLE-FUTURE-10', 'NEW-WORK-LEARN-07'
 )
   and not ('삶의 방향' = any (w.secondary_domains));

-- 4) 서비스 중 실천 1건: 제목의 '100%'를 말로 바꿈(설명에는 %가 없어 그대로)
update public.wellness_practices
   set title = '모든 일에 완벽을 요구하지 않는 연습을 하기'
 where id = 'WORK-MIND-L2-02'
   and title is distinct from '모든 일에 완벽을 요구하지 않는 연습을 하기';

commit;

-- 확인용(결과 3줄이 아래와 같아야 한다)
select tier, count(*) as "개수" from public.wellness_practices group by tier order by tier;
--   가볍게 시작 308 / 꾸준히 이어가기 142 / 장기 습관·정체성으로 125
select count(*) as "삶의 방향 2순위 개수 (49여야 함)" from public.wellness_practices where '삶의 방향' = any (secondary_domains);
select count(*) as "제목에 % 포함된 실천 (0이어야 함)" from public.wellness_practices where title like '%\%%' or detail like '%\%%';
