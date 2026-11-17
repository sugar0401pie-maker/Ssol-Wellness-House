-- =====================================================================
-- SSOL Wellness House — migration: 관리자 열람·내보내기 기록 (admin_access_log)
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-11-17: 관리자 페이지(/admin)가 이용자 대화를 내려받을 때마다 누가·언제·누구의 자료를·어떤 기간으로·몇 건 열람했는지 남긴다.
-- 개인정보처리방침 개정 예고문이 "열람 기록을 남긴다"고 약속한 항목이다. 이 기록이 남지 않으면 관리자 화면은 자료를 내주지 않는다(서버가 막는다).
-- 서버(service_role)만 읽고 쓴다 — 이용자·일반 로그인 계정은 접근할 수 없다. 기록에는 대화 원문을 넣지 않는다(건수·기간·대상 계정 id만).
-- 여러 번 실행해도 안전하다.
-- =====================================================================

begin;

create table if not exists public.admin_access_log (
  id             uuid primary key default gen_random_uuid(),
  admin_user_id  uuid not null,
  action         text not null,       -- login_ok / login_fail / search / export_account_chats / export_account_report / export_all_chats
  target_user_id uuid,                -- 자료를 연 대상 계정(종합 내보내기는 비워 둠)
  detail         jsonb not null default '{}'::jsonb,  -- 기간, 건수, 검색어 길이 등(원문·검색어 자체는 넣지 않는다)
  ip             text,
  created_at     timestamptz not null default now()
);

create index if not exists admin_access_log_created_idx on public.admin_access_log (created_at desc);
create index if not exists admin_access_log_login_fail_idx on public.admin_access_log (admin_user_id, action, created_at desc);

alter table public.admin_access_log enable row level security;
revoke all on public.admin_access_log from anon, authenticated;
grant select, insert on public.admin_access_log to service_role;

comment on table public.admin_access_log is '관리자 화면의 로그인·검색·내보내기 기록. 서버(service_role)만 접근. 수정·삭제 권한은 일부러 주지 않는다.';

notify pgrst, 'reload schema';

commit;
