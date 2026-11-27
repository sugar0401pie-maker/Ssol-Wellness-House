import { test } from "node:test";
import assert from "node:assert/strict";
import { approvalPath, buildApproveBody, buildReadyBody, checkApprove, isMobileUserAgent, parseReady } from "./kakaopayRequest.ts";

const ID = "3f2b7c1e-1111-4222-8333-944455556666";
const base = { cid: "TC0ONETIME", resultId: ID, orderId: `${ID}_Ab12Cd34`, userId: `saju-${ID}`, itemName: "살로 풀어보는 2027년 직장운 전체 리포트", amount: 990, page: 7, origin: "https://saju.ssolwellnesshouse.com" };

test("준비 요청: 금액·주문·사용자, 돌아올 주소는 결과 번호와 쪽이 경로에 들어간다", () => {
  const b = buildReadyBody(base);
  assert.equal(b.total_amount, 990);
  assert.equal(b.tax_free_amount, 0);
  assert.equal(b.quantity, 1);
  assert.equal(b.partner_order_id, base.orderId);
  assert.equal(b.partner_user_id, base.userId);
  assert.equal(b.approval_url, `https://saju.ssolwellnesshouse.com/checkout/${ID}/success/7`);
  assert.equal(b.cancel_url, `https://saju.ssolwellnesshouse.com/checkout/${ID}/fail/7`);
  assert.equal(b.fail_url, b.cancel_url);
});

test("돌아올 주소의 특수문자는 인코딩", () => {
  assert.equal(approvalPath("a/b?c", 4), "/checkout/a%2Fb%3Fc/success/4");
});

test("승인 요청은 준비 때와 같은 주문·사용자·거래 번호", () => {
  assert.deepEqual(buildApproveBody({ cid: "C", tid: "T1", orderId: "O", userId: "U", pgToken: "P" }), {
    cid: "C",
    tid: "T1",
    partner_order_id: "O",
    partner_user_id: "U",
    pg_token: "P",
  });
});

test("준비 응답: 거래 번호와 https 결제 주소가 있어야 한다", () => {
  assert.deepEqual(parseReady({ tid: "T1", next_redirect_pc_url: "https://online-pay.kakao.com/pc", next_redirect_mobile_url: "https://online-pay.kakao.com/mo" }), {
    tid: "T1",
    pcUrl: "https://online-pay.kakao.com/pc",
    mobileUrl: "https://online-pay.kakao.com/mo",
  });
  assert.equal(parseReady({ tid: "T1", next_redirect_pc_url: "javascript:alert(1)", next_redirect_mobile_url: "https://x" }), null);
  assert.equal(parseReady(null), null);
});

const exp = { tid: "T1", orderId: "O", userId: "U", amount: 990 };
const good = { aid: "A1", tid: "T1", partner_order_id: "O", partner_user_id: "U", amount: { total: 990 } };

test("승인 응답이 모두 일치하면 통과", () => {
  assert.deepEqual(checkApprove(good, exp), { ok: true, aid: "A1", total: 990 });
});

test("금액·주문·사용자·거래 번호가 하나라도 다르면 결과를 열지 않는다", () => {
  assert.equal(checkApprove({ ...good, amount: { total: 100 } }, exp).ok, false);
  assert.equal(checkApprove({ ...good, partner_order_id: "X" }, exp).ok, false);
  assert.equal(checkApprove({ ...good, partner_user_id: "X" }, exp).ok, false);
  assert.equal(checkApprove({ ...good, tid: "X" }, exp).ok, false);
  assert.equal(checkApprove({ ...good, aid: "" }, exp).ok, false);
  assert.equal(checkApprove(null, exp).ok, false);
});

test("휴대폰/컴퓨터 구분", () => {
  assert.equal(isMobileUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), true);
  assert.equal(isMobileUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120"), false);
});
