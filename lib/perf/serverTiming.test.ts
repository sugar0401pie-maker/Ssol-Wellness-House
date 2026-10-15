import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createTimer } from "./serverTiming.ts";

describe("createTimer", () => {
  test("작업별 소요 시간과 total을 Server-Timing 형식으로 만든다", async () => {
    let t = 0;
    const timer = createTimer(() => t);
    // 작업은 timer.time()이 시작 시각을 잰 "뒤에" 시간이 흐르도록 한 번 기다린 뒤 진행한다.
    const p = timer.time("db", (async () => { await Promise.resolve(); t += 30; return "ok"; })());
    assert.equal(await p, "ok");
    timer.mark("after");
    t += 10;
    assert.equal(timer.header(), "db;dur=30.0, after;dur=30.0, total;dur=40.0");
  });
  test("이름에 쓸 수 없는 글자는 밑줄로 바꾼다(헤더 깨짐 방지)", () => {
    const timer = createTimer(() => 0);
    timer.mark("a b;c,d");
    assert.match(timer.header(), /^a_b_c_d;dur=0\.0, total;dur=0\.0$/);
  });
  test("작업이 실패해도 시간은 기록되고 오류는 그대로 전달된다", async () => {
    let t = 0;
    const timer = createTimer(() => t);
    await assert.rejects(timer.time("bad", (async () => { await Promise.resolve(); t += 5; throw new Error("x"); })()), /x/);
    assert.match(timer.header(), /^bad;dur=5\.0/);
  });
});
