-- 작심삼일 챌린지(갓생러모임) — 2026-11-25 홈 화면 개편 요청문 v1.9.4 3·9·13장. 대표님: "유저가 쓰는 내용은 모두 DB에 남도록".
-- challenges: 챌린지 한 번 = 한 줄. closed_at이 비어 있는 것이 지금 화면에 보이는 챌린지(계정당 하나).
--   "다시 챌린지 하기(또심삼일)"·"다시 시작"을 누르면 closed_at을 채워 기록(지난 챌린지)으로 넘긴다.
-- challenge_checkins: 하루 한 번(KST) 저장 — N번째 저장이 N일차. 메모(40자)·행동·방식을 남긴다. 사진은 서버에 올리지 않는다(이 기기에서만).
-- challenge_rewards: 처음 3번을 채운 순간 계정당 한 번만(user_id가 기본 키라 두 번 생기지 않음). 리워드 내용은 정해지기 전이라 비워 둔다.
-- 모두 계정을 지우면 함께 지워진다(on delete cascade + 탈퇴 처리 목록). 서버(service_role)만 읽고 쓴다.

begin;

create table if not exists public.challenges (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  seq          integer not null,                          -- 그 사람의 몇 번째 챌린지
  theme        text not null,                             -- 기저 생각(마음) 키: worry · delay · energy …
  started_day  date not null,                             -- 1일차를 셀 수 있는 첫날(KST)
  status       text not null default 'active' check (status in ('active', 'done', 'expired')),
  ended_day    date,
  end_reason   text,                                      -- done(3번 완료) · expired(7일 지남)
  closed_at    timestamptz,                               -- 다시 하기로 기록에 넘긴 시각
  created_at   timestamptz not null default now(),
  unique (user_id, seq)
);
create unique index if not exists challenges_one_open_uidx on public.challenges (user_id) where closed_at is null;

create table if not exists public.challenge_checkins (
  id            bigint generated always as identity primary key,
  challenge_id  uuid not null references public.challenges (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  n             smallint not null check (n between 1 and 3),
  day_kst       date not null,
  method        text not null check (method in ('photo', 'memo', 'check')),
  memo          text check (memo is null or char_length(memo) <= 40),
  action        text not null,                            -- 그날의 행동 문구(나중에 문안이 바뀌어도 그때 것을 남긴다)
  created_at    timestamptz not null default now(),
  unique (challenge_id, n),
  unique (user_id, day_kst)                               -- 하루 한 번
);

create table if not exists public.challenge_rewards (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  challenge_id  uuid references public.challenges (id) on delete set null,
  earned_at     timestamptz not null default now(),
  reward_kind   text,                                     -- 정해지면 채운다(예: 이용 7일 연장)
  granted_at    timestamptz
);

alter table public.challenges enable row level security;
alter table public.challenge_checkins enable row level security;
alter table public.challenge_rewards enable row level security;
revoke all on public.challenges, public.challenge_checkins, public.challenge_rewards from anon, authenticated;
grant select, insert, update, delete on public.challenges, public.challenge_checkins, public.challenge_rewards to service_role;

notify pgrst, 'reload schema';

commit;
