-- 작심삼일 챌린지 리워드 = 쏘웰라 7일권 — 2026-11-26 대표님: "챌린지 3일 다 성공한 사람은 쏘웰라 7일권을 리워드로 드립니다 하고 실제로도 7일 연장해줘".
-- 3일을 처음 다 채운 계정(challenge_rewards에 한 줄, 계정당 한 번)에 chat_entitlements 행(plan 'challenge_reward' · 0원 · 'manual')을 하나 만든다.
-- 시작 시각 = 지금 · 무료체험 끝(서버가 넘겨 줌) · 남아 있는 이용권의 끝 중 가장 늦은 때 — 이미 받은 기간과 겹쳐 사라지지 않게 그 뒤로 7일을 붙인다.
-- 이 함수 하나가 확인·지급·기록을 한 번에 한다(같은 계정 요청이 동시에 와도 리워드 행을 잠가 한 번만 지급).
-- 오늘 전에 이미 3일을 채운 계정도 다음에 챌린지 화면을 열 때 같은 함수로 지급된다(granted_at이 비어 있으면).
-- 여러 번 실행해도 안전하다.

begin;

-- 1) 이용권 종류에 'challenge_reward' 추가(plan 제약을 이름과 상관없이 찾아 바꾼다 — status 제약은 건드리지 않는다)
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.chat_entitlements'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%plan%'
      and pg_get_constraintdef(oid) not like '%status%'
  loop
    execute format('alter table public.chat_entitlements drop constraint %I', c.conname);
  end loop;
end
$$;

alter table public.chat_entitlements
  add constraint chat_entitlements_plan_check
  check (plan in ('monthly', 'quarterly', 'annual', 'offline_package', 'challenge_reward'));

-- 2) 리워드 행에 어떤 이용권으로 줬는지
alter table public.challenge_rewards
  add column if not exists entitlement_id uuid references public.chat_entitlements (id) on delete set null;

-- 3) 지급 함수 — 돌려주는 값: granted(이번에 새로 줬는지) · expires_at(7일권 끝, 이미 줬으면 그때 것)
create or replace function public.grant_challenge_reward(p_user uuid, p_min_start timestamptz, p_days integer default 7)
returns table (granted boolean, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  r        public.challenge_rewards%rowtype;
  v_base   timestamptz;
  v_until  timestamptz;
  v_ent    uuid;
begin
  select * into r from public.challenge_rewards where user_id = p_user for update;
  if not found then
    return query select false, null::timestamptz; return;
  end if;
  if r.granted_at is not null then
    return query select false, (select e.expires_at from public.chat_entitlements e where e.id = r.entitlement_id); return;
  end if;

  select max(e.expires_at) into v_base
    from public.chat_entitlements e
   where e.user_id = p_user and e.status = 'active' and e.expires_at is not null and e.expires_at > now();
  v_base := greatest(now(), coalesce(p_min_start, now()), coalesce(v_base, now()));
  v_until := v_base + make_interval(days => greatest(1, least(p_days, 365)));

  insert into public.chat_entitlements (user_id, plan, status, amount, starts_at, expires_at, note, payment_provider)
  values (p_user, 'challenge_reward', 'active', 0, v_base, v_until, '작심삼일 챌린지 3일 완료 리워드', 'manual')
  returning id into v_ent;

  update public.challenge_rewards
     set reward_kind = 'chat_7d', granted_at = now(), entitlement_id = v_ent
   where user_id = p_user;

  return query select true, v_until;
end;
$$;

revoke all on function public.grant_challenge_reward(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.grant_challenge_reward(uuid, timestamptz, integer) to service_role;

notify pgrst, 'reload schema';

commit;
