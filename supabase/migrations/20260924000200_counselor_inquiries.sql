-- =====================================================================
-- SSOL Wellness House — migration: 상담사 연결 신청 저장
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-09-24 결정: 외부 예약 페이지로 바로 연결하는 대신, 앱 안에서 간단한 신청서를
-- 받아 저장만 해둔다(실제 상담 연결 프로세스는 아직 준비 중 — owner가 이 표를 보고
-- 수동으로 연락하는 방식). 서버(service_role)만 읽고 쓴다 — 사용자는 자기 신청 내역만
-- 볼 필요가 아직 없어서 select 정책은 만들지 않는다(필요해지면 추가).
-- =====================================================================

begin;

create table if not exists public.counselor_inquiries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  contact    text not null,       -- 연락받을 이메일 또는 전화번호
  message    text,                -- 하고 싶은 말(선택)
  status     text not null default 'pending' check (status in ('pending', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists counselor_inquiries_user_idx on public.counselor_inquiries (user_id);

alter table public.counselor_inquiries enable row level security;
revoke all on public.counselor_inquiries from anon, authenticated;
grant select, insert, update, delete on public.counselor_inquiries to service_role;

commit;
