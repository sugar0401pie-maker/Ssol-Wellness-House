// 구글 광고(Google Ads) 전환 — 2026-11-24 대표님 요청. 태그(gtag.js, AW-18592628933)는 app/layout.tsx가 모든 페이지에 붙인다.
// 결제 전환은 카카오페이 승인이 서버에서 끝난 직후 한 번만 보낸다(components/app/PricingSuccessPage.tsx).
// value = 실제 결제 금액(원), transaction_id = 주문 번호(chat_entitlements.id) — 같은 주문이 두 번 세지지 않게(구글도 같은 번호를 한 번만 센다).
// 개인정보(이메일·이름)는 보내지 않는다. 클라이언트 전용.
export const GOOGLE_ADS_ID = "AW-18592628933";

type Gtag = (...args: unknown[]) => void;
type W = Window & { dataLayer?: unknown[]; gtag?: Gtag };

const SENT_KEY = (orderId: string) => `adsPurchaseSent:${orderId}`;

export function reportPurchase(p: { value: number; transactionId: string }): boolean {
  if (typeof window === "undefined" || !p.transactionId || !(p.value > 0)) return false;
  try {
    if (window.sessionStorage.getItem(SENT_KEY(p.transactionId))) return false; // 새로고침해도 다시 보내지 않게
  } catch {
    // 저장소를 못 써도 구글이 transaction_id로 한 번만 센다
  }
  const w = window as W;
  // 태그가 아직 다 불러와지기 전이어도 dataLayer에 쌓아 두면 태그가 불러와진 뒤 보낸다.
  w.dataLayer = w.dataLayer || [];
  if (!w.gtag) w.gtag = function gtag() { w.dataLayer!.push(arguments); }; // eslint-disable-line prefer-rest-params
  w.gtag("event", "purchase", { value: Math.round(p.value), currency: "KRW", transaction_id: p.transactionId });
  try {
    window.sessionStorage.setItem(SENT_KEY(p.transactionId), "1");
  } catch {
    // 무시
  }
  return true;
}
