-- =====================================================================
-- SSOL Wellness House — migration: 내 정보에 휴대전화번호·주소·마케팅 동의 추가
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-09-25 owner 요청: 마이페이지 "내 정보 확인"과 회원가입 화면에 휴대전화번호,
-- 주소(도로명 검색), 마케팅 정보 활용 동의(선택)를 추가한다. 휴대전화번호는 SMS
-- 인증 사업자가 아직 없어(PLAN.md §7-9) 인증 없이 텍스트로만 저장한다 — 실제 본인
-- 확인이 필요해지면 별도로 SMS 인증을 붙여야 한다.
-- 마케팅 동의는 CLAUDE.md 6장 "동의 종류는 별도" 원칙대로 다른 동의(서비스/민감정보)와
-- 분리된 컬럼으로 두고, 기본값 false(옵트인)로 한다.
-- 여러 번 실행해도 안전하다.
-- =====================================================================

begin;

alter table public.profiles
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists marketing_consent_at timestamptz;

comment on column public.profiles.phone is
  '휴대전화번호. SMS 인증 사업자 미도입으로 인증 없이 저장만 함(신뢰 단계 낮음).';
comment on column public.profiles.address is
  '도로명 주소 검색(Daum 우편번호 서비스)으로 입력한 주소 + 상세주소.';
comment on column public.profiles.marketing_consent is
  '마케팅 정보 활용 동의(선택, 기본 미동의). 서비스/민감정보 동의와 별개 컬럼.';

commit;
