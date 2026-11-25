import { test } from "node:test";
import assert from "node:assert/strict";
import { authPathFor, currentNext, safeNext } from "./authPaths.ts";

test("로그인 화면마다 자기 주소", () => {
  assert.equal(authPathFor("signin", null), "/login");
  assert.equal(authPathFor("reset", null), "/login/reset");
  assert.equal(authPathFor("signup", null), "/signup");
  assert.equal(authPathFor("landing", null), "/");
  assert.equal(authPathFor("signin", "/challenge/day/1"), "/login?next=%2Fchallenge%2Fday%2F1");
});

test("돌아갈 주소는 이 사이트 안의 화면만", () => {
  assert.equal(safeNext("/chat?from=tarot&result=1"), "/chat?from=tarot&result=1");
  for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "/login", "/login/reset", "/signup", "/", "", null]) assert.equal(safeNext(bad), null, String(bad));
});

test("지금 화면에서 들고 갈 돌아갈 주소", () => {
  assert.equal(currentNext("/challenge", "?theme=worry"), "/challenge?theme=worry");
  assert.equal(currentNext("/login", "?next=%2Fchat"), "/chat");
  assert.equal(currentNext("/login", ""), null);
  assert.equal(currentNext("/", ""), null);
});
