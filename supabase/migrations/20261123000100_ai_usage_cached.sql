-- AI 사용량 기록에 "캐시 할인 받은 입력 토큰" 칸 추가 — 2026-11-23 대표님 승인(AI 비용 줄이기 2번).
-- OpenAI는 프롬프트 앞부분이 매번 같으면(1,024토큰 이상) 그 부분을 싸게 계산한다. 그 토큰 수를 따로 남겨 실제 할인을 본다.
-- 이 칸이 생기기 전에도 기록은 그대로 쌓인다(lib/ai/usage.ts가 칸이 없으면 빼고 기록).
-- 단가(1백만 토큰당 달러, 2026-11 기준): gpt-5.6-luna 입력 0.20 · 캐시 입력 0.02 · 출력 1.20 / text-embedding-3-small 입력 0.02. 원화는 1달러=1,400원으로 어림.

alter table public.ai_usage_log add column if not exists cached_input_tokens integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ai_usage_log_cached_input_tokens_check') then
    alter table public.ai_usage_log add constraint ai_usage_log_cached_input_tokens_check check (cached_input_tokens >= 0);
  end if;
end $$;

-- 추정 금액을 캐시 할인까지 반영해 다시 계산하고, 맨 끝에 cached_input_tokens 합계를 더한다(기존 칸 순서는 그대로).
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
    when 'gpt-5.6-luna'           then (sum(input_tokens) - sum(cached_input_tokens)) * 0.20 + sum(cached_input_tokens) * 0.02 + sum(output_tokens) * 1.20
    when 'text-embedding-3-small' then sum(input_tokens) * 0.02
  end / 1e6)::numeric, 4)          as est_usd,
  round((case model
    when 'gpt-5.6-luna'           then (sum(input_tokens) - sum(cached_input_tokens)) * 0.20 + sum(cached_input_tokens) * 0.02 + sum(output_tokens) * 1.20
    when 'text-embedding-3-small' then sum(input_tokens) * 0.02
  end / 1e6 * 1400)::numeric, 1)   as est_krw,
  sum(cached_input_tokens)::bigint as cached_input_tokens
from public.ai_usage_log
group by 1, 2, 3, 4;

revoke all on public.ai_usage_daily from anon, authenticated;
grant select on public.ai_usage_daily to service_role;

notify pgrst, 'reload schema';
