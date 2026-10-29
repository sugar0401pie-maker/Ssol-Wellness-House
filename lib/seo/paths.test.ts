import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PRIVATE_PATHS, PUBLIC_PATHS } from "./paths.ts";

const isBlocked = (path: string) => PRIVATE_PATHS.some((p) => (p.endsWith("/") ? path.startsWith(p) : path === p || path.startsWith(`${p}/`)));

describe("검색엔진 안내 주소", () => {
  test("사이트맵에 올린 공개 주소는 robots가 막지 않는다", () => {
    for (const p of PUBLIC_PATHS) assert.equal(isBlocked(p), false, `${p}가 막혀 있음`);
  });

  test("로그인 뒤 화면·내 정보·결제 결과·서버 주소는 막혀 있다", () => {
    for (const p of ["/api/chat", "/home", "/chat", "/mypage", "/report/abc", "/session-reserve", "/pricing/success", "/pricing/fail"]) {
      assert.equal(isBlocked(p), true, `${p}가 열려 있음`);
    }
  });

  test("이용권 안내(/pricing) 자체는 막지 않는다 — 결제 결과 두 곳만 막음", () => {
    assert.equal(isBlocked("/pricing"), false);
  });
});
