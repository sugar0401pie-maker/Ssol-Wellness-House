import { test } from "node:test";
import assert from "node:assert/strict";
import { MYPAGE_PANEL_PATH, VERIFY_TTL_MS, isVerifiedRecently, panelFromPath } from "./panels.ts";

test("마이페이지 팝업마다 주소", () => {
  assert.equal(panelFromPath("/mypage"), null);
  assert.equal(panelFromPath("/mypage/feedback"), "feedback");
  assert.equal(panelFromPath("/mypage/info/verify"), "verify");
  assert.equal(panelFromPath("/mypage/info"), "info");
  assert.equal(panelFromPath("/mypage/info/"), "info");
  assert.equal(panelFromPath("/mypage/info/withdraw"), "withdraw");
  assert.equal(panelFromPath("/mypage/insights"), null);
  for (const [k, v] of Object.entries(MYPAGE_PANEL_PATH)) assert.equal(panelFromPath(v), k);
});

test("비밀번호 확인은 10분 동안만", () => {
  assert.equal(isVerifiedRecently(null, 1000), false);
  assert.equal(isVerifiedRecently(1000, 1000 + VERIFY_TTL_MS - 1), true);
  assert.equal(isVerifiedRecently(1000, 1000 + VERIFY_TTL_MS), false);
  assert.equal(isVerifiedRecently(5000, 1000), false); // 시계가 거꾸로면 다시 확인
});
