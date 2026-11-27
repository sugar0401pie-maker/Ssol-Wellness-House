// 카카오페이 단건 결제 요청 만들기·응답 검증 — 순수 함수(네트워크·비밀 키 없음, 시험: kakaopayRequest.test.ts).
// 쏘웰라(메인 저장소 lib/billing/kakaopayRequest.ts)와 같은 API·같은 검증. 돌아올 주소만 사주 화면에 맞춘다.
// 공식 API: https://open-api.kakaopay.com/online/v1/payment/{ready,approve}, 헤더 "Authorization: SECRET_KEY <키>".
// 시험용 가맹점 코드(CID)는 TC0ONETIME + 개발용(dev) Secret key.

export type ReadyInput = {
  cid: string;
  resultId: string;  // 사주 결과 번호(UUID)
  orderId: string;   // 이번 결제 시도의 주문 번호 — partner_order_id
  userId: string;    // partner_user_id(로그인 연결 전이라 결과 번호로 만든 값)
  itemName: string;
  amount: number;
  page: number;      // 결제를 시작한 결과 쪽(끝나면 이 쪽으로 돌아감)
  origin: string;    // 예: https://saju.ssolwellnesshouse.com
};

// 돌아올 주소에는 쿼리 대신 경로를 쓴다 — 카카오페이가 approval_url 뒤에 pg_token을 붙일 때
// 이미 붙어 있던 쿼리가 사라졌다는 보고가 있어서(쏘웰라와 같은 이유). 화면마다 자기 주소(hard rule)이기도 하다.
export const approvalPath = (resultId: string, page: number) => `/checkout/${encodeURIComponent(resultId)}/success/${page}`;
export const failPath = (resultId: string, page: number) => `/checkout/${encodeURIComponent(resultId)}/fail/${page}`;

export function buildReadyBody(i: ReadyInput) {
  return {
    cid: i.cid,
    partner_order_id: i.orderId,
    partner_user_id: i.userId,
    item_name: i.itemName,
    quantity: 1,
    total_amount: i.amount,
    tax_free_amount: 0,
    approval_url: `${i.origin}${approvalPath(i.resultId, i.page)}`,
    cancel_url: `${i.origin}${failPath(i.resultId, i.page)}`,
    fail_url: `${i.origin}${failPath(i.resultId, i.page)}`,
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

export type ApproveCheck = { ok: true; aid: string; total: number } | { ok: false; error: string };
// 승인 응답이 "우리 주문 그대로"인지 확인한다: 같은 주문·같은 사용자·같은 거래(tid)·같은 금액이어야 결과를 연다.
export function checkApprove(body: unknown, expected: { tid: string; orderId: string; userId: string; amount: number }): ApproveCheck {
  const b = body as Record<string, unknown> | null;
  const amount = (b?.amount as Record<string, unknown> | undefined)?.total;
  if (typeof b?.aid !== "string" || !b.aid) return { ok: false, error: "승인 응답에 승인 번호가 없어요." };
  if (b.tid !== expected.tid || b.partner_order_id !== expected.orderId || b.partner_user_id !== expected.userId) {
    return { ok: false, error: "승인된 결제가 이 주문과 일치하지 않아요." };
  }
  if (amount !== expected.amount) return { ok: false, error: "결제 금액이 일치하지 않아요." };
  return { ok: true, aid: b.aid, total: amount };
}

// 휴대폰이면 모바일 결제 화면(카카오톡 앱으로 이어짐), 컴퓨터면 PC 화면(QR·카카오톡 알림 결제).
export const isMobileUserAgent = (ua: string) => /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua);
