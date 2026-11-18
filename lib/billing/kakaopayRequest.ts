// 카카오페이 단건 결제(직접 연동)의 요청 내용 만들기·응답 검증 — 순수 함수(네트워크·비밀 키 없음, 시험: kakaopayRequest.test.ts).
// 실제 호출은 lib/billing/kakaopay.ts(서버 전용)가 한다.
// 공식 API(2024~): https://open-api.kakaopay.com/online/v1/payment/{ready,approve}, 헤더 "Authorization: SECRET_KEY <키>", JSON 본문.
// 시험용 가맹점 코드(CID)는 TC0ONETIME이고, 그때는 개발용(dev) Secret key를 쓴다(카카오페이 개발자 포럼 직원 답변, 2024-04).

export type ReadyInput = {
  cid: string;
  orderId: string;   // 우리 chat_entitlements 행 id — partner_order_id
  userId: string;    // partner_user_id
  itemName: string;
  amount: number;
  origin: string;    // 예: https://app.ssolwellnesshouse.com
};

// 승인 후 돌아올 주소. 주문 번호를 경로에 넣는다(카카오페이가 approval_url 뒤에 pg_token을 붙이는데,
// 이미 붙어 있던 쿼리가 사라졌다는 보고가 있어서 쿼리 대신 경로를 쓴다).
export const approvalPath = (orderId: string) => `/pricing/kakaopay/${encodeURIComponent(orderId)}`;

export function buildReadyBody(i: ReadyInput) {
  return {
    cid: i.cid,
    partner_order_id: i.orderId,
    partner_user_id: i.userId,
    item_name: i.itemName,
    quantity: 1,
    total_amount: i.amount,
    tax_free_amount: 0,
    approval_url: `${i.origin}${approvalPath(i.orderId)}`,
    cancel_url: `${i.origin}/pricing?kakaopay=cancel`,
    fail_url: `${i.origin}/pricing/fail?provider=kakaopay`,
  };
}

export type ReadyResult = { tid: string; pcUrl: string; mobileUrl: string };
export function parseReady(body: unknown): ReadyResult | null {
  const b = body as Record<string, unknown> | null;
  const tid = b?.tid, pc = b?.next_redirect_pc_url, mo = b?.next_redirect_mobile_url;
  if (typeof tid !== "string" || !tid || typeof pc !== "string" || typeof mo !== "string") return null;
  if (!/^https:\/\//.test(pc) || !/^https:\/\//.test(mo)) return null; // 카카오페이가 준 주소만 그대로 연다
  return { tid, pcUrl: pc, mobileUrl: mo };
}

export function buildApproveBody(p: { cid: string; tid: string; orderId: string; userId: string; pgToken: string }) {
  return { cid: p.cid, tid: p.tid, partner_order_id: p.orderId, partner_user_id: p.userId, pg_token: p.pgToken };
}

export type ApproveCheck = { ok: true; aid: string; total: number; method: string | null } | { ok: false; error: string };
// 승인 응답이 "우리 주문 그대로"인지 확인한다: 같은 주문·같은 사용자·같은 거래(tid)·같은 금액이어야 이용권을 연다.
export function checkApprove(body: unknown, expected: { tid: string; orderId: string; userId: string; amount: number }): ApproveCheck {
  const b = body as Record<string, unknown> | null;
  const amount = (b?.amount as Record<string, unknown> | undefined)?.total;
  if (typeof b?.aid !== "string" || !b.aid) return { ok: false, error: "승인 응답에 승인 번호가 없어요." };
  if (b.tid !== expected.tid || b.partner_order_id !== expected.orderId || b.partner_user_id !== expected.userId) return { ok: false, error: "승인된 결제가 이 주문과 일치하지 않아요." };
  if (amount !== expected.amount) return { ok: false, error: "결제 금액이 일치하지 않아요." };
  return { ok: true, aid: b.aid, total: amount, method: typeof b.payment_method_type === "string" ? b.payment_method_type : null };
}

// 휴대폰이면 모바일 결제 화면(카카오톡 앱으로 이어짐), 컴퓨터면 PC 화면(QR·카카오톡 알림 결제).
export const isMobileUserAgent = (ua: string) => /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua);
