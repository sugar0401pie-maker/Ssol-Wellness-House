-- =====================================================================
-- SSOL Wellness House — migration: 홈 화면에 표시할 "대표 유형" 지정 컬럼 추가
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-09-28 owner 요청: 마이페이지 "내 유형 열람하기" 목록에서 특정 응시 기록을
-- "대표 유형으로 선택"하면, 홈 화면 캐릭터·채팅 개인화가 항상 "가장 최근 응시 결과"가
-- 아니라 이 응시 결과를 쓰도록 한다. 값이 비어 있으면(선택 안 함) 기존처럼 최신 결과를 쓴다.
--
-- ssol_quiz_results는 다른 앱 소유(ssol_ 접두사)라 CLAUDE.md 규칙상 그 테이블에 FK 제약을
-- 걸지 않는다 — 여기 저장하는 id는 "느슨한 참조"일 뿐이고, 실제 유효성(내 것이 맞는지,
-- 아직 존재하는지)은 조회 시점(lib/mypage/loadQuizPersona.ts)에 애플리케이션 코드가 확인한다.
-- =====================================================================

begin;

alter table public.profiles
  add column if not exists primary_quiz_result_id uuid;

comment on column public.profiles.primary_quiz_result_id is
  '홈 화면/채팅에 쓸 "대표 유형"으로 고른 ssol_quiz_results.id(다른 앱 소유 테이블, FK 제약 없음 — 느슨한 참조). null이면 최신 응시 결과를 쓴다.';

commit;
