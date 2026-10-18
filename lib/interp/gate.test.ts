import { test } from "node:test";
import assert from "node:assert/strict";
import { interpRoutes, isInterpEnabled, MIN_CHARS, parseAllowlist, shouldAnalyze } from "./gate.ts";

const U = "AAAAAAAA-0000-4000-8000-000000000001";

test("환경 변수를 하나도 안 넣어도 기본은 전체 켜짐(owner 결정)", () => {
  assert.equal(isInterpEnabled({}, U), true);
  assert.equal(isInterpEnabled({ SW_INTERP_ALLOWLIST: "" }, U), true);
  assert.equal(isInterpEnabled({ SW_INTERP_ALLOWLIST: "   " }, U), true);
});

test("SW_INTERP_ENABLED=0이면 허용 목록과 상관없이 항상 꺼짐(끄기 스위치)", () => {
  assert.equal(isInterpEnabled({ SW_INTERP_ENABLED: "0" }, U), false);
  assert.equal(isInterpEnabled({ SW_INTERP_ENABLED: "0", SW_INTERP_ALLOWLIST: "*" }, U), false);
});

test("허용 목록을 넣으면 사용자 id(대소문자 무시) 또는 이메일이 있는 사람만 켜짐", () => {
  const env = { SW_INTERP_ALLOWLIST: ` ${U.toLowerCase()} , me@x.com ` };
  assert.equal(isInterpEnabled(env, U), true);
  assert.equal(isInterpEnabled(env, "other-id", "ME@X.com"), true);
  assert.equal(isInterpEnabled(env, "other-id", "you@x.com"), false);
  assert.equal(isInterpEnabled(env, "other-id"), false);
});

test("'*'는 전체", () => {
  assert.equal(isInterpEnabled({ SW_INTERP_ALLOWLIST: "*" }, "any"), true);
  assert.equal(parseAllowlist("*,a@b.com").all, true);
});

test("분석 대상 경로: 기본은 일상 웰니스·인생 결정·힘든 감정이고, 위기·폭력·진단/약물·서비스 문의는 제외", () => {
  const r = interpRoutes(undefined);
  for (const ok of ["wellness", "life_decision", "clinical_distress"]) assert.ok(r.has(ok));
  for (const no of ["crisis", "violence", "clinical_diagnosis", "service_info"]) assert.ok(!r.has(no));
});

test("너무 짧은 말은 분석하지 않는다", () => {
  const r = interpRoutes(undefined);
  assert.equal(shouldAnalyze("wellness", "네", r), false);
  assert.equal(shouldAnalyze("wellness", "x".repeat(MIN_CHARS - 1), r), false);
  assert.equal(shouldAnalyze("wellness", "요즘 사람 만나면 진이 빠져요", r), true);
  assert.equal(shouldAnalyze("crisis", "요즘 사람 만나면 진이 빠져요", r), false);
});
