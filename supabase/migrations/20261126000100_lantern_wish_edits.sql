-- 풍등 소원 고치기 기록(대표님 2026-11-26: "소원 다시 보기"로 고치면 고친 시각과 예전 소원 글도 남기기).
-- ① sky_lantern_wishes.updated_at: 마지막으로 고친 시각(처음 날린 시각 created_at은 그대로 — 화면의 높이 계산에 씀).
-- ② sky_lantern_wish_edits: 고칠 때마다 고치기 전 소원 글과 고친 시각을 한 줄씩. 누가 썼는지(user_id)도 함께.
-- 다른 이용자에게 보이지 않고 서버(service_role)만 읽고 쓴다. 탈퇴하면 함께 지운다(lib/account/withdrawPlan.ts), 소원이 지워지면 기록도 함께 지워진다.
-- 여러 번 실행해도 괜찮다.

begin;

alter table public.sky_lantern_wishes add column if not exists updated_at timestamptz;

create table if not exists public.sky_lantern_wish_edits (
  id             bigint generated always as identity primary key,
  wish_id        bigint not null references public.sky_lantern_wishes (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  previous_wish  text not null,                               -- 고치기 전 소원 글
  edited_at      timestamptz not null default now()           -- 고친 시각
);

create index if not exists sky_lantern_wish_edits_wish_idx on public.sky_lantern_wish_edits (wish_id, edited_at);
create index if not exists sky_lantern_wish_edits_user_idx on public.sky_lantern_wish_edits (user_id);

alter table public.sky_lantern_wish_edits enable row level security;
revoke all on public.sky_lantern_wish_edits from anon, authenticated;
grant select, insert, update, delete on public.sky_lantern_wish_edits to service_role;

notify pgrst, 'reload schema';

commit;
