-- =====================================================================
-- SSOL Wellness House — migration: 채팅 이용권(무료체험/유료 플랜) 저장
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-09-27 결정: 가입 후 7일은 무료체험, 이후엔 이용권 결제가 필요하다. 결제 대행사
-- (토스페이먼츠)는 아직 연동 전이라, 지금은 신청만 접수해 이 표에 status='pending'으로
-- 남기고, owner가 실제 결제를 확인한 뒤 Supabase 테이블 편집기에서 status를 'active'로
-- 바꿔주는 수동 절차를 쓴다. 토스 연동 후에는 결제 성공 웹훅이 같은 표에 'active' 행을
-- 직접 쓰도록 바꿀 예정 — 그래서 토스 관련 컬럼을 미리 넉넉히(nullable로) 마련해둔다.
--
-- ssol_orders/ssol_chat_passes(다른 앱 소유, ssol_ 접두사)와는 별개다: CLAUDE.md 규칙상
-- ssol_* 테이블은 절대 쓰지 않으므로, 이 앱 전용의 새 표를 우리 프로젝트에 만든다.
-- =====================================================================

begin;

create table if not exists public.chat_entitlements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  plan           text not null check (plan in ('monthly', 'annual', 'offline_package')),
  status         text not null default 'pending' check (status in ('pending', 'active', 'canceled', 'expired')),
  amount         integer,               -- 원화 금액(참고용) — 오프라인 패키지 무료 부여 시 0 또는 null
  starts_at      timestamptz,
  expires_at     timestamptz,
  note           text,                  -- 관리자 메모(예: 오프라인 패키지 종류, 수동 처리 사유)
  toss_order_id  text,                  -- 토스페이먼츠 연동 후 사용
  toss_payment_key text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists chat_entitlements_user_idx on public.chat_entitlements (user_id);

alter table public.chat_entitlements enable row level security;
revoke all on public.chat_entitlements from anon, authenticated;
grant select, insert, update, delete on public.chat_entitlements to service_role;

commit;
