-- =====================================================================
-- SSOL Wellness House — migration: 상담사 연결 신청서를 실제 예약 문의 양식으로 확장
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-09-25 owner 요청: ssolwellnesshouse.com의 실제 예약 페이지(프로그램/날짜/시간/
-- 개인정보 항목)와 같은 내용으로 앱 안에서 신청받는다. 아직 실시간 캘린더 연동이 없어서
-- "가능한 시간 2~3개"를 후보로 받고(preferred_times, 배열), 관리자가 보고 확정 연락을
-- 준다 — 그래서 시간은 하나가 아니라 배열로 저장한다.
-- 기존 contact/message 컬럼은 그대로 두되(과거 신청 데이터 보존), 새 항목을 추가한다.
-- 여러 번 실행해도 안전하다.
-- =====================================================================

begin;

alter table public.counselor_inquiries
  add column if not exists name              text,
  add column if not exists phone             text,
  add column if not exists email             text,
  add column if not exists age_range         text,
  add column if not exists gender            text,
  add column if not exists referral_source   text,
  add column if not exists program           text,   -- '신규고객 면담' | '기존고객 세션예약'
  add column if not exists preferred_date    date,
  add column if not exists preferred_times   text[], -- 예: {'09:00 ~ 09:50', '14:00 ~ 14:50'}
  add column if not exists other_availability text,  -- "다른 가능한 시간대" 자유 기재
  add column if not exists agreed_at         timestamptz,
  add column if not exists notified_at       timestamptz; -- 이메일 알림 발송 성공 시각(실패 시 null로 남아 나중에 재확인 가능)

commit;
