import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { extractBearer, userIdFromClaims } from "./bearer.ts";

describe("extractBearer", () => {
  test("Bearer 토큰을 꺼내고, 대소문자·앞뒤 공백을 허용한다", () => {
    assert.equal(extractBearer("Bearer abc.def.ghi"), "abc.def.ghi");
    assert.equal(extractBearer("bearer   abc "), "abc");
  });
  test("형식이 다르거나 없으면 null", () => {
    assert.equal(extractBearer(null), null);
    assert.equal(extractBearer(undefined), null);
    assert.equal(extractBearer(""), null);
    assert.equal(extractBearer("Basic abc"), null);
    assert.equal(extractBearer("Bearer"), null);
  });
});

describe("userIdFromClaims", () => {
  test("로그인한 사용자 토큰(role=authenticated + sub)만 인정한다", () => {
    assert.equal(userIdFromClaims({ sub: "u-1", role: "authenticated" }), "u-1");
  });
  test("익명(임시) 계정 토큰은 거부하고, is_anonymous가 false면 인정한다", () => {
    assert.equal(userIdFromClaims({ sub: "u-1", role: "authenticated", is_anonymous: true }), null);
    assert.equal(userIdFromClaims({ sub: "u-1", role: "authenticated", is_anonymous: false }), "u-1");
  });
  test("공개용 anon 토큰·service 토큰·sub 없음·빈 값은 거부한다(안전한 쪽)", () => {
    assert.equal(userIdFromClaims({ role: "anon" }), null);
    assert.equal(userIdFromClaims({ sub: "u-1", role: "anon" }), null);
    assert.equal(userIdFromClaims({ sub: "u-1", role: "service_role" }), null);
    assert.equal(userIdFromClaims({ role: "authenticated" }), null);
    assert.equal(userIdFromClaims({ sub: "", role: "authenticated" }), null);
    assert.equal(userIdFromClaims({ sub: 123, role: "authenticated" }), null);
    assert.equal(userIdFromClaims(null), null);
    assert.equal(userIdFromClaims(undefined), null);
  });
});
