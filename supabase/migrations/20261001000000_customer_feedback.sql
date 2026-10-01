-- =====================================================================
-- SSOL Wellness House — migration: 마이페이지 "고객의 의견" 저장
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-10-01 owner 요청: 마이페이지에 건의/제안 접수 기능 추가. counselor_inquiries와
-- 같은 패턴 — 서버(service_role)만 읽고 쓰고, 사용자는 자기 제출 내역을 다시 볼 필요가
-- 아직 없어서 select 정책은 만들지 않는다(필요해지면 추가).
--
-- name/phone/email은 사용자가 폼에 다시 입력하지 않고, 제출 시점의 profiles/auth.users
-- 값을 그대로 스냅샷해서 저장한다(요청에 입력 필드로 명시되지 않았고, 동의 문구에 이미
-- "성명과 연락처를 포함한 접수 내용을 수집"한다고 안내하므로 계정 정보를 재사용).
-- =====================================================================

begin;

create table if not exists public.customer_feedback (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  category           text not null check (category in ('web_error', 'payment_error', 'service_suggestion', 'other')),
  content            text not null,
  name               text,              -- 제출 시점 profiles.display_name 스냅샷
  phone              text,              -- 제출 시점 profiles.phone 스냅샷
  email              text,              -- 제출 시점 auth.users.email 스냅샷
  consent_agreed_at  timestamptz not null,
  status             text not null default 'pending' check (status in ('pending', 'reviewed', 'resolved')),
  notified_at        timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists customer_feedback_user_idx on public.customer_feedback (user_id);

alter table public.customer_feedback enable row level security;
revoke all on public.customer_feedback from anon, authenticated;
grant select, insert, update, delete on public.customer_feedback to service_role;

commit;
