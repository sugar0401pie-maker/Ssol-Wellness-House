// 가격은 engine/02_데이터/pricing.json에서만 정한다(설계 문서 5장 #10). 이 파일은 "지금 얼마인지"만 계산한다.
// 순수 함수 — 날짜를 받아 계산하므로 테스트할 수 있다(pricing.test.ts).

export type PricingData = {
  list_price: number;
  sale_price: number;
  sale_badge: string;
  sale_until: string; // ISO, 한국 시간 포함(+09:00)
};

export type PriceNow = {
  price: number;
  listPrice: number;
  onSale: boolean;
  badge: string | null;
  priceText: string;
  listText: string;
};

export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export function priceAt(p: PricingData, now: Date): PriceNow {
  const onSale = now.getTime() <= new Date(p.sale_until).getTime();
  const price = onSale ? p.sale_price : p.list_price;
  return {
    price,
    listPrice: p.list_price,
    onSale,
    badge: onSale ? p.sale_badge : null,
    priceText: won(price),
    listText: won(p.list_price),
  };
}
