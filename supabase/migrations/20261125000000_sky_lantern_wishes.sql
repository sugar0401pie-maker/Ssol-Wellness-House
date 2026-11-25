-- 풍등 날리기 소원 글 — 2026-11-25 홈 화면 개편 요청문 v1.9.4 2장(대표님: "유저가 쓰는 내용은 모두 DB에 남도록").
-- 로그인한 이용자가 소원을 한 줄(40자) 적어 풍등을 날린다. 이벤트 기간(새해까지)에 한 번만(대표님 2026-11-25) — event_key로 묶는다.
-- 다른 이용자에게는 보이지 않는다. 계정을 지우면 함께 지워진다(auth.users on delete cascade + 탈퇴 처리 목록). 서버(service_role)만 읽고 쓴다.
-- 앞서 보여 드린 '하루 한 번' 판을 이미 실행했어도 이 SQL을 그대로 다시 실행하면 된다(있으면 고치고, 없으면 만든다).

begin;

create table if not exists public.sky_lantern_wishes (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  event_key   text not null,                               -- 예: lantern-2026-11-26 (이벤트 시작일)
  day_kst     date not null,                               -- 날린 날(KST)
  wish        text not null check (char_length(wish) between 1 and 40),
  color       text,
  created_at  timestamptz not null default now()
);

-- '하루 한 번' 판을 이미 만든 경우: event_key를 더하고 하루 한 번 제약을 뺀다.
alter table public.sky_lantern_wishes add column if not exists event_key text;
update public.sky_lantern_wishes set event_key = 'lantern-2026-11-26' where event_key is null;
alter table public.sky_lantern_wishes alter column event_key set not null;
alter table public.sky_lantern_wishes drop constraint if exists sky_lantern_wishes_user_id_day_kst_key;

-- 이벤트마다 한 번
create unique index if not exists sky_lantern_wishes_user_event_uidx on public.sky_lantern_wishes (user_id, event_key);
create index if not exists sky_lantern_wishes_day_idx on public.sky_lantern_wishes (day_kst);

alter table public.sky_lantern_wishes enable row level security;
revoke all on public.sky_lantern_wishes from anon, authenticated;
grant select, insert, update, delete on public.sky_lantern_wishes to service_role;

notify pgrst, 'reload schema';

commit;
