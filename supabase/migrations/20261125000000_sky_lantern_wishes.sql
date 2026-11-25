-- 풍등 날리기 소원 글 — 2026-11-25 홈 화면 개편 요청문 v1.9.4 2장(대표님: "유저가 쓰는 내용은 모두 DB에 남도록").
-- 로그인한 이용자가 하루(KST) 한 번 소원을 한 줄(40자) 적어 풍등을 날린다. 다른 이용자에게는 보이지 않는다.
-- 계정을 지우면 함께 지워진다(auth.users on delete cascade + 탈퇴 처리 목록). 서버(service_role)만 읽고 쓴다.
-- help_hint: 소원 글에 위기·폭력의 직접 표현이 있어 끝 화면에 '도움받을 곳'을 함께 보여 준 경우(lib/safety/explicit.ts) — 운영 확인용.

begin;

create table if not exists public.sky_lantern_wishes (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  day_kst     date not null,
  wish        text not null check (char_length(wish) between 1 and 40),
  color       text,
  help_hint   boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, day_kst)                                -- 하루 한 번
);
create index if not exists sky_lantern_wishes_day_idx on public.sky_lantern_wishes (day_kst);

alter table public.sky_lantern_wishes enable row level security;
revoke all on public.sky_lantern_wishes from anon, authenticated;
grant select, insert, update, delete on public.sky_lantern_wishes to service_role;

notify pgrst, 'reload schema';

commit;
