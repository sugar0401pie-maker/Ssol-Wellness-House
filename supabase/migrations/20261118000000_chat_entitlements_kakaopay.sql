-- =====================================================================
-- SSOL Wellness House — migration: 이용권 결제에 카카오페이(직접 연동) 추가
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-11-18: /pricing의 이용권 버튼을 누르면 주문서 없이 카카오페이 결제창으로 바로 간다(대표님 결정).
-- 카카오페이 거래 번호(tid)와 승인 번호(aid)를 저장할 칸, 어떤 결제 수단으로 결제됐는지(payment_provider)를 추가한다.
-- 기존 토스 결제 행은 그대로 두고, 앞으로의 토스 결제도 같은 표를 쓴다. 여러 번 실행해도 안전하다.
-- =====================================================================

begin;

alter table public.chat_entitlements add column if not exists payment_provider text;
alter table public.chat_entitlements add column if not exists kakaopay_tid text;
alter table public.chat_entitlements add column if not exists kakaopay_aid text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chat_entitlements_payment_provider_check') then
    alter table public.chat_entitlements
      add constraint chat_entitlements_payment_provider_check check (payment_provider is null or payment_provider in ('toss', 'kakaopay', 'manual'));
  end if;
end
$$;

comment on column public.chat_entitlements.payment_provider is '결제 수단: toss / kakaopay / manual(수동 승인). 예전 행은 비어 있음(토스 키가 있으면 토스).';
comment on column public.chat_entitlements.kakaopay_tid is '카카오페이 결제 준비 때 받은 거래 번호(tid). 승인할 때 그대로 다시 보낸다.';
comment on column public.chat_entitlements.kakaopay_aid is '카카오페이 승인 번호(aid). 값이 있으면 실제 결제가 승인된 것.';

notify pgrst, 'reload schema';

commit;
