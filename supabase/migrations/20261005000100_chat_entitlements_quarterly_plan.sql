-- =====================================================================
-- SSOL Wellness House — migration: 이용권 종류에 3개월권(quarterly) 추가
-- (Supabase SQL Editor에 전체를 붙여넣고 Run — 새 코드를 배포하기 *전에* 먼저 실행할 것)
--
-- 2026-10-05 owner 요청: 10월 한정 3개월권(실제 결제 5,700원)을 만든다. chat_entitlements.plan은
-- ('monthly','annual','offline_package')만 허용하는 check 제약이 걸려 있어서, 이걸 넓히지 않으면
-- 3개월권 주문 생성(체크아웃)이 DB에서 거부된다. 기존 행·데이터는 그대로 두고 제약만 교체한다.
-- 여러 번 실행해도 안전하다.
-- =====================================================================

begin;

-- plan 컬럼에 걸린 check 제약을 이름과 상관없이 찾아서 지운다(status 제약은 건드리지 않는다).
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
  check (plan in ('monthly', 'quarterly', 'annual', 'offline_package'));

commit;
