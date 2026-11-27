-- 결제 칸 추가(이미 saju_results를 만든 뒤 한 번 실행). 처음 만든 표(첫 판 SQL)에는 결제 칸이 없어서 다섯 칸을 모두 더한다.
-- 여러 번 실행해도 안전하다(if not exists).
alter table public.saju_results add column if not exists order_id text unique;   -- 주문 번호(결제 시도마다 새로)
alter table public.saju_results add column if not exists payment_key text;       -- 카카오페이 승인 번호(aid, 환불·조회용)
alter table public.saju_results add column if not exists kakaopay_tid text;      -- 카카오페이 거래 번호(결제 준비 때 받음)
alter table public.saju_results add column if not exists pending_amount integer; -- 준비할 때 정한 금액(원)
alter table public.saju_results add column if not exists paid_amount integer;    -- 실제 승인된 금액(원)
