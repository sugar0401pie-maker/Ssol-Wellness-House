-- =====================================================================
-- SSOL Wellness House — migration: 통합본(SSOL_Practices_Unified_v1.0) 중 '기존 575개'에 대한 반영 사항
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-10-06 owner 승인 사항:
--   1) 제목 39개를 통합본 제목으로 통일(수정 표시 있던 33개 + 표시 없던 6개 모두)
--   2) 그중 27개는 현재 DB 제목이 9/28 v2에서 다시 쓴 것이라, 새 제목과 설명이 겹치지 않게
--      그 27개의 설명(detail)을 "어떻게 해보는지" 중심으로 다시 썼다(나머지 548개의 설명은 그대로).
--   3) tier 157개 변경 반영("다 반영"): 꾸준히 이어가기→가볍게 시작 155개, 가볍게 시작→꾸준히 이어가기 2개
--      → 홈 '오늘의 실천' 후보(가볍게 시작)가 155개에서 308개로 늘어난다.
--   4) 통합본이 새로 붙인 '삶의 방향' 2순위 19개 추가(기존 30개는 그대로) → 합계 49개
--   5) 숫자%가 들어가 출력 검사에 걸리는 서비스 중 실천 1건의 제목 문구 수정(WORK-MIND-L2-02, 100% → 완벽)
-- 다른 컬럼·다른 테이블(practice_eligibility 포함)은 건드리지 않는다. 여러 번 실행해도 안전하다(멱등).
-- 서버는 실천 목록을 5분 동안 기억해 두므로, 실행 후 최대 5분 뒤부터 앱에 반영된다.
-- =====================================================================

begin;

-- 1) 제목 39개
update public.wellness_practices w
   set title = v.title
  from (values
    ('SELF-BODY-L1-01', '집 앞을 10~15분 걸으며 기분 전환하기'),
    ('SELF-BODY-L1-03', '엘리베이터 대신 계단을 이용해 몸에 작은 자극을 주기'),
    ('SELF-BODY-L1-05', '아침에 가볍게 기지개 켜며 몸 깨우기'),
    ('SELF-BODY-L3-03', '습관을 오래 유지하기 위해 같이 취미생활 할 사람 찾기'),
    ('SELF-TALK-L1-03', '작은 감사 표현으로 관계와 기분 모두 데우기'),
    ('SELF-TALK-L1-04', '말하기 전에 글로 먼저 정리하며 감정 선명하게 하기'),
    ('SELF-TALK-L3-01', '에너지를 빼앗는 관계와의 만남을 서서히 줄이기'),
    ('SELF-CARE-L3-01', '수면·식사·운동, 세 가지 기본을 꾸준히 챙기는 습관 만들기'),
    ('SELF-HELP-L1-03', '혼자 끌어안지 않고 힘들다는 것부터 주변에 알리기'),
    ('SELF-HELP-L2-04', '도움을 청하는 것도 능력이라고 여기는 연습하기'),
    ('REL-BODY-L1-02', '작은 인사로 관계의 첫걸음 만들기'),
    ('REL-BODY-L2-03', '공동의 목표로 관계를 자연스럽게 이어가기'),
    ('REL-BODY-L2-04', '꾸준히 참석하며 관계 다지기'),
    ('REL-MIND-L1-03', '부정적 감정이 클수록 상대 입장에서 한 번 더 생각해보기'),
    ('REL-MIND-L1-05', '상황을 다르게 바라보며 관계에 여유 만들기'),
    ('REL-MIND-L2-03', '내가 관계에서 우선시하는 것을 알고 선택 기준으로 삼기'),
    ('REL-TALK-L1-03', '질문 하나로 대화의 문 열기'),
    ('REL-CARE-L1-03', '모든 초대에 응하지 않아도 괜찮다고 여기는 연습하기'),
    ('REL-CARE-L2-05', '매주 사람 만나는 시간과 혼자 쉬는 시간을 의식적으로 나누기'),
    ('COUPLE-BODY-L1-01', '말없이 나란히 걸으며 연결감 느끼기'),
    ('COUPLE-BODY-L1-02', '작은 스킨십으로 정서적 유대 강화하기'),
    ('COUPLE-BODY-L1-03', '짧은 스킨십보다 조금 더 오래 안아보기'),
    ('COUPLE-BODY-L1-04', '함께 요리하며 몸을 움직이고 기분 환기하기'),
    ('COUPLE-BODY-L2-04', '바쁠수록 잊기 쉬운 스킨십을 챙기기'),
    ('COUPLE-TALK-L2-03', '관계가 편해질수록 서로의 마음을 더 자주 확인하기'),
    ('WORK-BODY-L2-04', '공간을 정돈해 집중력과 기분 높이기'),
    ('WORK-TALK-L1-03', '작은 인정의 말로 관계와 분위기 데우기'),
    ('WORK-TALK-L3-05', '혼자 애쓰지 않고 원하는 방향을 주변에 알리기'),
    ('WORK-HELP-L3-01', '필요하면 전문가 도움이나 구조적 변화를 고려하기'),
    ('PARENT-BODY-L1-04', '멀리 나가지 않고 집 근처에서 가볍게 바람 쐬기'),
    ('PARENT-BODY-L2-05', '비슷한 처지의 사람과 함께 운동 이어가기'),
    ('PARENT-BODY-L3-03', '부모의 체력이 곧 육아의 지속가능성임을 받아들이기'),
    ('PARENT-MIND-L3-02', '아이만이 아니라 나도 함께 자라고 있음을 받아들이기'),
    ('PARENT-TALK-L2-02', '생각이 다른 부분을 정기적으로 조율하기'),
    ('PARENT-CARE-L1-04', '가장 버거운 때를 알아두고 미리 대비하기'),
    ('PARENT-CARE-L3-01', '나를 돌보는 시간을 오래 가는 습관으로 자리잡게 하기'),
    ('PARENT-CARE-L3-04', '나를 돌보는 것이 아이에게도 좋다는 것을 체득하기'),
    ('NEW-SELF-VALUES-08', '지금은 좇지 않아도 될 목표 하나 내려놓기'),
    ('NEW-WORK-TRANSITION-04', '업무가 끝나면 화면 배경 바꾸기')
  ) as v(id, title)
 where w.id = v.id
   and w.title is distinct from v.title;

-- 2) 설명 27개(새 제목과 겹치지 않게 다시 씀)
update public.wellness_practices w
   set detail = v.detail
  from (values
    ('COUPLE-BODY-L1-01', '휴대폰은 주머니에 넣고 같은 속도로 5~10분만 걸어보세요. 이야기를 채우려 하지 않아도 괜찮아요.'),
    ('COUPLE-BODY-L1-02', '손을 잡거나 어깨에 살짝 기대는 정도로 시작해보세요. 상대가 편안해하는 선에서만 나눠요.'),
    ('COUPLE-BODY-L1-03', '평소보다 몇 초만 더 안은 채 천천히 숨을 쉬어보세요. 서로 편안한 만큼만 해요.'),
    ('COUPLE-BODY-L1-04', '재료 손질과 간 보기를 나눠 맡아 간단한 메뉴 하나를 같이 만들어보세요. 완성도보다 같이 움직이는 데 마음을 둬요.'),
    ('COUPLE-BODY-L2-04', '출근 전 짧은 포옹이나 잠들기 전 손잡기처럼 하루 한 번 정해두면 잊지 않고 이어가기 쉬워요. 서로 편안한 선을 지켜요.'),
    ('PARENT-BODY-L1-04', '함께 있어줄 어른이 있다면 잠깐 혼자, 아니면 아이와 함께 집 앞 한 바퀴만 돌며 하늘이나 나무를 올려다보세요.'),
    ('PARENT-BODY-L2-05', '같은 시간대에 움직일 수 있는 지인이나 모임을 찾아 주 1~2회 가볍게 시작해보세요. 약속이 있으면 이어가기 쉬워요.'),
    ('PARENT-BODY-L3-03', '아이를 위해 쓰던 시간 중 일부를 내 운동 시간으로 떼어 일정에 미리 적어두세요. 짧아도 괜찮아요.'),
    ('PARENT-CARE-L1-04', '이번 주 가장 힘들었던 시간대를 메모해두고, 그 시간 전에 도움을 청하거나 쉴 틈을 하나 만들어보세요.'),
    ('PARENT-CARE-L3-01', '매일 같은 시간에 10분이라도 나를 위한 일을 넣어두세요. 거창하지 않아도 매일 이어지는 쪽이 오래 가요.'),
    ('PARENT-CARE-L3-04', '내 몫의 쉼을 챙긴 날, 아이를 대하는 마음이 어땠는지 한 줄 적어보세요. 부모가 편안하면 아이도 안정감을 느낄 수 있어요.'),
    ('PARENT-MIND-L3-02', '육아하며 달라진 점이나 새로 배운 것을 한 가지씩 적어보세요. 서툴렀던 순간도 함께 적어도 좋아요.'),
    ('REL-BODY-L1-02', '마주치는 사람과 눈을 맞추고 한마디 인사를 먼저 건네보세요. 길지 않아도 충분해요.'),
    ('REL-BODY-L2-03', '함께 할 작은 일(산책, 전시 보기, 한 달 독서 등) 하나를 정해 날짜를 잡아보세요. 만날 이유가 생겨요.'),
    ('REL-BODY-L2-04', '모임 하나를 골라 한 달 동안 빠지지 않고 참석해보세요. 얼굴을 자주 보이는 것만으로도 가까워질 수 있어요.'),
    ('REL-MIND-L1-03', '감정이 올라올 때 잠깐 멈추고 ''상대에게는 어떤 사정이 있었을까?''를 한 가지만 떠올려보세요. 상대 편을 드는 게 아니라 시야를 넓혀보는 거예요.'),
    ('REL-MIND-L1-05', '속상한 상황을 한 문장으로 적고, 다른 설명을 한 가지만 덧붙여보세요. 예: ''무시했다'' 대신 ''바빴을 수도 있다''.'),
    ('REL-MIND-L2-03', '관계에서 꼭 지키고 싶은 것을 세 가지 적고, 약속이나 부탁을 정할 때 그 기준에 비춰보세요.'),
    ('REL-TALK-L1-03', '''요즘 뭐가 제일 재밌어요?''처럼 짧고 열린 질문을 하나 준비해 건네보세요. 대답을 끝까지 들어주면 대화가 이어져요.'),
    ('SELF-BODY-L1-01', '신발만 신고 나가 집 앞을 한 바퀴 돌아보세요. 걷는 동안은 휴대폰 대신 주변 소리와 하늘에 눈을 둬요.'),
    ('SELF-BODY-L1-03', '오늘 오르내리는 층 중 한 구간만 계단으로 가보세요. 숨이 차면 천천히, 무리하지 않는 만큼만 해요.'),
    ('SELF-BODY-L1-05', '일어나자마자 침대에서 팔과 다리를 쭉 펴고 숨을 길게 내쉬어보세요. 30초면 충분해요.'),
    ('SELF-BODY-L3-03', '함께 운동하거나 배울 사람을 한 명만 찾아 정해진 요일에 만나보세요. 약속이 있으면 미루기 어려워요.'),
    ('SELF-TALK-L1-03', '오늘 고마웠던 사람에게 ''덕분에 편했어요'' 같은 한마디를 말이나 문자로 전해보세요.'),
    ('SELF-TALK-L1-04', '하고 싶은 말을 메모장에 세 줄로 적어보세요. 지금 느낌, 그 이유, 바라는 것 순서로 쓰면 돼요.'),
    ('WORK-BODY-L2-04', '퇴근 전 책상 위에 올려둔 것 중 오늘 안 쓴 것만 제자리에 두세요. 5분이면 충분해요.'),
    ('WORK-TALK-L1-03', '동료가 한 일 중 고마웠던 점을 구체적으로 짚어 한마디 전해보세요. 예: ''자료 정리해줘서 바로 쓸 수 있었어요''.')
  ) as v(id, detail)
 where w.id = v.id
   and w.detail is distinct from v.detail;

-- 3) tier 157개
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

-- 4) '삶의 방향' 2순위 19개 추가(이미 있으면 그대로)
update public.wellness_practices w
   set secondary_domains = array_append(w.secondary_domains, '삶의 방향')
 where w.id in (
    'SELF-HELP-L2-05', 'REL-MIND-L3-02', 'REL-TALK-L3-02', 'COUPLE-BODY-L3-04', 'COUPLE-MIND-L3-02', 'COUPLE-MIND-L3-05', 'COUPLE-TALK-L2-05', 'COUPLE-HELP-L3-04', 'WORK-BODY-L3-04', 'WORK-MIND-L3-04', 'WORK-CARE-L3-03', 'WORK-CARE-L3-05', 'WORK-HELP-L3-03', 'PARENT-MIND-L3-02', 'PARENT-MIND-L3-04', 'PARENT-CARE-L3-02', 'NEW-SELF-VALUES-09', 'NEW-COUPLE-FUTURE-10', 'NEW-WORK-LEARN-07'
 )
   and not ('삶의 방향' = any (w.secondary_domains));

-- 5) 서비스 중 실천 1건: 제목의 '100%'를 말로 바꿈(설명에는 %가 없어 그대로)
update public.wellness_practices
   set title = '모든 일에 완벽을 요구하지 않는 연습을 하기'
 where id = 'WORK-MIND-L2-02'
   and title is distinct from '모든 일에 완벽을 요구하지 않는 연습을 하기';

commit;

-- 확인용(아래 4줄 결과가 기대값과 같아야 한다)
select tier, count(*) as "개수" from public.wellness_practices group by tier order by tier;
--   기대: 가볍게 시작 308 / 꾸준히 이어가기 142 / 장기 습관·정체성으로 125
select count(*) as "삶의 방향 2순위 개수 (49여야 함)" from public.wellness_practices where '삶의 방향' = any (secondary_domains);
select count(*) as "% 포함된 실천 (0이어야 함)" from public.wellness_practices where title like '%\%%' or detail like '%\%%';
select count(*) as "전체 실천 수 (575여야 함)" from public.wellness_practices;
