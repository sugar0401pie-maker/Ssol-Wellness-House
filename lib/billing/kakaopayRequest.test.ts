import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { approvalPath, buildApproveBody, buildReadyBody, checkApprove, isMobileUserAgent, parseReady } from "./kakaopayRequest.ts";

const base = { cid: "TC0ONETIME", orderId: "11111111-2222-3333-4444-555555555555", userId: "u-1", itemName: "3개월 멤버십", amount: 8700, origin: "https://app.ssolwellnesshouse.com" };

describe("카카오페이 요청 만들기", () => {
  test("준비 요청: 금액·주문·사용자, 돌아올 주소 3개", () => {
    const b = buildReadyBody(base);
    assert.equal(b.total_amount, 8700);
    assert.equal(b.tax_free_amount, 0);
    assert.equal(b.quantity, 1);
    assert.equal(b.partner_order_id, base.orderId);
    assert.equal(b.partner_user_id, "u-1");
    assert.equal(b.approval_url, `https://app.ssolwellnesshouse.com/pricing/kakaopay/${base.orderId}`);
    assert.equal(b.cancel_url, "https://app.ssolwellnesshouse.com/pricing?kakaopay=cancel");
    assert.equal(b.fail_url, "https://app.ssolwellnesshouse.com/pricing/fail?provider=kakaopay");
  });
  test("승인 주소의 주문 번호는 경로에 들어가고 특수문자는 인코딩", () => {
    assert.equal(approvalPath("a/b?c"), "/pricing/kakaopay/a%2Fb%3Fc");
  });
  test("승인 요청은 준비 때와 같은 주문·사용자·거래 번호", () => {
    assert.deepEqual(buildApproveBody({ cid: "C", tid: "T1", orderId: "O", userId: "U", pgToken: "P" }), { cid: "C", tid: "T1", partner_order_id: "O", partner_user_id: "U", pg_token: "P" });
  });
});

describe("카카오페이 응답 검증", () => {
  test("준비 응답: 거래 번호와 https 결제 주소가 있어야 한다", () => {
    assert.deepEqual(parseReady({ tid: "T1", next_redirect_pc_url: "https://online-pay.kakao.com/pc", next_redirect_mobile_url: "https://online-pay.kakao.com/mo" }), { tid: "T1", pcUrl: "https://online-pay.kakao.com/pc", mobileUrl: "https://online-pay.kakao.com/mo" });
    assert.equal(parseReady({ tid: "T1", next_redirect_pc_url: "javascript:alert(1)", next_redirect_mobile_url: "https://x" }), null);
    assert.equal(parseReady({ next_redirect_pc_url: "https://a", next_redirect_mobile_url: "https://b" }), null);
    assert.equal(parseReady(null), null);
  });
  const exp = { tid: "T1", orderId: "O", userId: "U", amount: 8700 };
  const good = { aid: "A1", tid: "T1", partner_order_id: "O", partner_user_id: "U", amount: { total: 8700 }, payment_method_type: "MONEY" };
  test("모두 일치하면 통과", () => {
    assert.deepEqual(checkApprove(good, exp), { ok: true, aid: "A1", total: 8700, method: "MONEY" });
  });
  test("금액·주문·사용자·거래 번호가 하나라도 다르면 이용권을 열지 않는다", () => {
    assert.equal(checkApprove({ ...good, amount: { total: 100 } }, exp).ok, false);
    assert.equal(checkApprove({ ...good, partner_order_id: "X" }, exp).ok, false);
    assert.equal(checkApprove({ ...good, partner_user_id: "X" }, exp).ok, false);
    assert.equal(checkApprove({ ...good, tid: "X" }, exp).ok, false);
    assert.equal(checkApprove({ ...good, aid: "" }, exp).ok, false);
    assert.equal(checkApprove(null, exp).ok, false);
  });
  test("휴대폰/컴퓨터 구분", () => {
    assert.equal(isMobileUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), true);
    assert.equal(isMobileUserAgent("Mozilla/5.0 (Linux; Android 14; SM-S918N) Mobile"), true);
    assert.equal(isMobileUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120"), false);
  });
});
