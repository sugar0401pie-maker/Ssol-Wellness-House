-- =====================================================================
-- SSOL Wellness House — migration: profiles에 닉네임 컬럼 추가
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-09-25 owner 요청: 마이페이지 "내 정보"에 이름(실명)·닉네임·생년월일이 다 보여야 하는데,
-- 지금 profiles.display_name은 가입 시 입력한 "실명"으로 쓰이고 있어(LoginScreen 가입 폼의
-- "이름" 필드) 닉네임을 담을 별도 칸이 없었다. display_name은 실명 의미 그대로 두고,
-- 화면 표시(인사말 등)에 쓸 별칭은 이 nickname 컬럼에 새로 저장한다.
-- nickname이 비어 있으면 기존처럼 display_name(실명)을 그대로 보여준다(하위 호환).
-- 여러 번 실행해도 안전하다.
-- =====================================================================

begin;

alter table public.profiles
  add column if not exists nickname text;

comment on column public.profiles.nickname is
  '화면에 표시할 별칭(실명과 별개, 선택). 비어 있으면 display_name(실명)을 대신 보여준다.';

commit;
