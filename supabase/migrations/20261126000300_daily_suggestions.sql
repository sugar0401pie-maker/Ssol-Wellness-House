-- 오늘의 제안 기록 — 2026-11-26 CSO 묶음 v2.40(엔진 ssol_daily · 규칙 DAILY-01).
-- 고민 타파의 「오늘 이렇게 해보면 어떨까요?」는 엔진 dailySuggestion이 고른다. 엔진은 "최근에 나간 것 7개"를 빼고 고르므로
-- 하루에 하나씩 남겨 둔다: 같은 날은 같은 제안(새로 고쳐도 그대로) · 다음 날은 최근 7개를 뺀 새 제안.
-- 서버(service_role)만 읽고 쓴다. 계정을 지우면 함께 지워진다.

begin;

create table if not exists public.daily_suggestions (
  user_id      uuid not null references auth.users (id) on delete cascade,
  day_kst      date not null,
  practice_id  text,                 -- 운영 실천표 id(타로 계획 칸처럼 id가 없는 제안이면 비움)
  title        text not null,
  detail       text,
  source       text not null,        -- tarot_plan · tarot · test · conversation · interest · fallback
  why          text,                 -- 엔진이 고른 까닭(관리용 — 사용자에게 보여 주지 않음)
  created_at   timestamptz not null default now(),
  primary key (user_id, day_kst)
);

alter table public.daily_suggestions enable row level security;
revoke all on public.daily_suggestions from anon, authenticated;
grant select, insert, update, delete on public.daily_suggestions to service_role;

notify pgrst, 'reload schema';

commit;
