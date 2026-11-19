import { test } from "node:test";
import assert from "node:assert/strict";
import { PROFILE_RESET, WITHDRAW_DELETE_TABLES, WITHDRAW_DETAILS, WITHDRAW_KEEP_TABLES, withdrawNotice } from "./withdrawPlan.ts";

test("탈퇴는 쏘웰라 정보만 — 다른 사이트(ssol_*·타로·아스트로) 표와 결제 기록은 지우지 않는다", () => {
  const del = new Set<string>(WITHDRAW_DELETE_TABLES);
  for (const t of WITHDRAW_KEEP_TABLES) assert.equal(del.has(t), false, t);
  for (const t of del) assert.doesNotMatch(t, /^(ssol_|tarot_|astro_)/);
  assert.equal(del.has("chat_entitlements"), false); // 전자상거래법 대금결제 기록 5년
  assert.ok(del.has("chat_messages") && del.has("chat_sessions") && del.has("user_onboarding"));
});

test("프로필은 지우지 않고 쏘웰라에서 받은 값만 비운다 — 이용 시작일은 남김(무료체험 반복 방지)", () => {
  assert.ok(!("trial_started_at" in PROFILE_RESET));
  assert.ok(!("user_id" in PROFILE_RESET));
  for (const k of ["display_name", "nickname", "phone", "address", "birth_date"] as const) assert.equal(PROFILE_RESET[k], null);
  assert.equal(PROFILE_RESET.marketing_consent, false);
});

test("팝업 문장: 닉네임이 있으면 이름으로, 없으면 회원님 · 결제 기록이 남는다는 안내 포함", () => {
  assert.equal(withdrawNotice("쏠이"), "회원 탈퇴 시 쏘웰라AI에 저장된 쏠이님의 정보가 삭제됩니다.");
  assert.equal(withdrawNotice("  "), "회원 탈퇴 시 쏘웰라AI에 저장된 회원님의 정보가 삭제됩니다.");
  assert.ok(WITHDRAW_DETAILS.some((d) => /결제 기록/.test(d) && /5년/.test(d)));
});
