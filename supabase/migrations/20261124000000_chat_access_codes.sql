-- 채팅 이용 코드 — 2026-11-24 대표님 요청.
-- 오프라인 웰니스 세션 패키지 이용자에게 10자리 이상의 무작위 코드를 주고, /pricing에서 코드를 등록하면 정해진 기간 동안 채팅을 무료로 쓴다.
-- 코드는 원문을 저장하지 않고 지문(sha256)과 끝 4자리만 둔다(관리용). 만드는 도구: scripts/make_access_codes.mjs(코드는 그때 한 번만 화면에 나옴).
-- 등록하면 chat_entitlements에 plan 'offline_package' · 0원 · 결제수단 'manual' 행이 생긴다(이용권 판정은 그 행으로 — 기존 그대로).
-- 지금 이용권이 남아 있으면 그 끝 다음부터 이어서 센다(이미 받은 기간이 겹쳐 사라지지 않게). 서버(service_role)만 쓴다.

begin;

create table if not exists public.chat_access_codes (
  id          uuid primary key default gen_random_uuid(),
  code_hash   text not null unique,                       -- sha256(대문자·하이픈 뺀 코드)
  code_hint   text not null,                              -- 끝 4자리(어느 코드인지 알아보는 용도)
  days        integer not null check (days between 1 and 3650),
  max_uses    integer not null default 1 check (max_uses >= 1),
  used_count  integer not null default 0 check (used_count >= 0),
  note        text,                                       -- 예: 어느 패키지·누구에게 준 코드인지
  expires_at  timestamptz,                                -- 코드 등록 마감(없으면 마감 없음)
  created_at  timestamptz not null default now()
);

create table if not exists public.chat_access_code_redemptions (
  id              bigint generated always as identity primary key,
  code_id         uuid not null references public.chat_access_codes (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  entitlement_id  uuid references public.chat_entitlements (id) on delete set null,
  redeemed_at     timestamptz not null default now(),
  unique (code_id, user_id)
);
create index if not exists chat_access_code_redemptions_user_idx on public.chat_access_code_redemptions (user_id);

alter table public.chat_access_codes enable row level security;
alter table public.chat_access_code_redemptions enable row level security;
revoke all on public.chat_access_codes from anon, authenticated;
revoke all on public.chat_access_code_redemptions from anon, authenticated;
grant select, insert, update, delete on public.chat_access_codes to service_role;
grant select, insert, update, delete on public.chat_access_code_redemptions to service_role;

-- 코드 등록(한 번에 처리 — 같은 코드를 동시에 여러 번 눌러도 사용 횟수를 넘지 않게 코드 행을 잠근다).
-- 돌려주는 reason: ok · not_found · expired · used_up · already_yours
create or replace function public.redeem_chat_access_code(p_user uuid, p_code_hash text)
returns table (ok boolean, reason text, entitlement_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  c        public.chat_access_codes%rowtype;
  v_base   timestamptz;
  v_until  timestamptz;
  v_ent    uuid;
begin
  select * into c from public.chat_access_codes where code_hash = p_code_hash for update;
  if not found then
    return query select false, 'not_found'::text, null::timestamptz; return;
  end if;
  if c.expires_at is not null and c.expires_at < now() then
    return query select false, 'expired'::text, null::timestamptz; return;
  end if;
  if exists (select 1 from public.chat_access_code_redemptions r where r.code_id = c.id and r.user_id = p_user) then
    return query select false, 'already_yours'::text, null::timestamptz; return;
  end if;
  if c.used_count >= c.max_uses then
    return query select false, 'used_up'::text, null::timestamptz; return;
  end if;

  -- 남아 있는 이용권(만료일이 있는 것 중 가장 늦은 끝)이 지금보다 뒤면 그 다음부터 센다.
  select greatest(now(), coalesce(max(e.expires_at), now())) into v_base
    from public.chat_entitlements e
   where e.user_id = p_user and e.status = 'active' and e.expires_at is not null and e.expires_at > now();
  v_base := coalesce(v_base, now());
  v_until := v_base + make_interval(days => c.days);

  insert into public.chat_entitlements (user_id, plan, status, amount, starts_at, expires_at, note, payment_provider)
  values (p_user, 'offline_package', 'active', 0, v_base, v_until, '이용 코드 …' || c.code_hint || coalesce(' · ' || c.note, ''), 'manual')
  returning id into v_ent;

  update public.chat_access_codes set used_count = used_count + 1 where id = c.id;
  insert into public.chat_access_code_redemptions (code_id, user_id, entitlement_id) values (c.id, p_user, v_ent);

  return query select true, 'ok'::text, v_until;
end;
$$;

revoke all on function public.redeem_chat_access_code(uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_chat_access_code(uuid, text) to service_role;

notify pgrst, 'reload schema';

commit;
