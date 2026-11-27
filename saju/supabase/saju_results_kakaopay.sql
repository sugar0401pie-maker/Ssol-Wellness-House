-- 카카오페이 결제용 칸 추가(2026-11-27, 토스 대신 카카오페이). saju_results.sql을 이미 실행했다면 이것만 한 번 더 실행한다.
-- 결제 준비 때 받은 거래 번호(tid)와 금액을 적어 두고, 승인 때 같은 거래·같은 금액인지 확인한다(lib/store.ts setPending/getPending).
alter table public.saju_results add column if not exists kakaopay_tid text;    -- 카카오페이 거래 번호(결제 준비 때 받음)
alter table public.saju_results add column if not exists pending_amount integer; -- 준비할 때 정한 금액(원) — 승인 금액과 같아야 열림
comment on column public.saju_results.payment_key is '카카오페이 승인 번호(aid) — 환불·조회용';
