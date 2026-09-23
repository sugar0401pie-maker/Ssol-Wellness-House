-- =====================================================================
-- SSOL Wellness House — migration: 회원가입 화면 확장(이름/생년월일/약관 동의)
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-09-23: ssolwellnesshouse.com 실제 가입 화면과 맞추면서 필요해진 컬럼.
-- 기존 profiles.birth_year(연도만)는 그대로 두고, 실제로 받는 생년월일 전체를
-- birth_date에 별도 저장한다. 약관/민감정보 동의는 기존 adult_confirmed_at 같은
-- "자기 확인 시각" 패턴을 그대로 따른다 — 동의했다는 사실과 시각만 기록하고,
-- 동의 문구 자체(버전)는 저장하지 않는다(필요해지면 나중에 버전 컬럼 추가).
-- 여러 번 실행해도 안전하다.
-- =====================================================================

begin;

alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists terms_agreed_at timestamptz,
  add column if not exists sensitive_data_agreed_at timestamptz;

comment on column public.profiles.birth_date is
  '가입 시 입력한 생년월일 전체. birth_year(연도만, 예전 컬럼)와 별개로 둠.';
comment on column public.profiles.terms_agreed_at is
  '개인정보 처리방침·이용약관·국외이전 동의 시각(자기 확인, 문구 버전은 저장하지 않음).';
comment on column public.profiles.sensitive_data_agreed_at is
  '테스트 응답 등 민감정보 수집·이용 동의 시각(자기 확인).';

commit;
