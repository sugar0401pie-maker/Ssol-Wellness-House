-- AI 사용량(토큰 수) 기록 — 2026-11-23 대표님 요청. AI를 부를 때마다 한 줄씩 쌓인다(lib/ai/usage.ts).
-- 대화 내용·개인정보는 넣지 않는다: 누가(user_id)·어느 대화(session_id)·어떤 기능·모델·토큰 수만. 사용자별 월 비용 한도(3,000원) 확인용.
-- 서버(service_role)만 읽고 쓴다. 회원 탈퇴 때 그 사람의 줄은 지운다(lib/account/withdrawPlan.ts).

create table if not exists public.ai_usage_log (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  user_id       uuid,
  session_id    uuid,
  route         text not null,
  feature       text not null,
  model         text not null,
  input_tokens  integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0)
);

create index if not exists ai_usage_log_created_at_idx on public.ai_usage_log (created_at);
create index if not exists ai_usage_log_user_created_idx on public.ai_usage_log (user_id, created_at);

alter table public.ai_usage_log enable row level security;
revoke all on public.ai_usage_log from anon, authenticated;
grant select, insert, delete on public.ai_usage_log to service_role;

-- 하루·기능·모델별 합계와 추정 금액. 단가(1백만 토큰당 달러)는 2026-11 기준 — 바뀌면 이 뷰만 고친다.
-- gpt-5.6-luna 입력 0.20 / 출력 1.20, text-embedding-3-small 입력 0.02. 모르는 모델은 금액을 비워 둔다. 원화는 1달러=1,400원으로 어림.
create or replace view public.ai_usage_daily with (security_invoker = true) as
select
  (created_at at time zone 'Asia/Seoul')::date as day_kst,
  route,
  feature,
  model,
  count(*)                         as calls,
  count(distinct user_id)          as users,
  sum(input_tokens)::bigint        as input_tokens,
  sum(output_tokens)::bigint       as output_tokens,
  round((case model
    when 'gpt-5.6-luna'           then sum(input_tokens) * 0.20 + sum(output_tokens) * 1.20
    when 'text-embedding-3-small' then sum(input_tokens) * 0.02
  end / 1e6)::numeric, 4)          as est_usd,
  round((case model
    when 'gpt-5.6-luna'           then sum(input_tokens) * 0.20 + sum(output_tokens) * 1.20
    when 'text-embedding-3-small' then sum(input_tokens) * 0.02
  end / 1e6 * 1400)::numeric, 1)   as est_krw
from public.ai_usage_log
group by 1, 2, 3, 4;

revoke all on public.ai_usage_daily from anon, authenticated;
grant select on public.ai_usage_daily to service_role;
