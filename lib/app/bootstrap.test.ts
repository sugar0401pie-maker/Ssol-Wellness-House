import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { BOOT_MAX_AGE_MS, BOOT_PATHS, createBootstrap, type BootKey } from "./bootstrap.ts";

function setup(opts: { token?: string | null; fail?: BootKey[] } = {}) {
  let now = 1000;
  const calls: string[] = [];
  const b = createBootstrap({
    getToken: async () => (opts.token === undefined ? "tok" : opts.token),
    fetchJson: async (path) => {
      calls.push(path);
      const key = (Object.keys(BOOT_PATHS) as BootKey[]).find((k) => BOOT_PATHS[k] === path)!;
      return opts.fail?.includes(key) ? null : { key };
    },
    now: () => now,
  });
  return { b, calls, advance: (ms: number) => (now += ms) };
}

describe("bootstrap", () => {
  test("start()는 요청 4개를 동시에 출발시키고, 여러 번 불러도 한 번만 출발한다", async () => {
    const { b, calls } = setup();
    b.start();
    b.start();
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual([...calls].sort(), Object.values(BOOT_PATHS).sort());
  });
  test("take()는 미리 받은 값을 한 번만 넘겨주고, 두 번째는 null(평소처럼 직접 요청)", async () => {
    const { b } = setup();
    b.start();
    assert.deepEqual(await b.take("onboarding")!, { key: "onboarding" });
    assert.equal(b.take("onboarding"), null);
  });
  test("20초가 지나 낡은 값은 버린다", async () => {
    const { b, advance } = setup();
    b.start();
    advance(BOOT_MAX_AGE_MS + 1);
    assert.equal(b.take("profile"), null);
  });
  test("로그인 정보가 없으면 요청하지 않고 null을 돌려준다(호출한 쪽이 직접 처리)", async () => {
    const { b, calls } = setup({ token: null });
    b.start();
    assert.equal(await b.take("billing")!, null);
    assert.equal(calls.length, 0);
  });
  test("요청이 실패하면 null — 오류를 던지지 않는다", async () => {
    const { b } = setup({ fail: ["billing"] });
    b.start();
    assert.equal(await b.take("billing")!, null);
    assert.deepEqual(await b.take("onboarding")!, { key: "onboarding" });
  });
  test("홈 데이터는 온보딩을 마친 사용자일 때만 미리 받은 값을 쓴다(미완료·미확인이면 버림)", async () => {
    const done = setup();
    done.b.start();
    done.b.setOnboardingCompleted(true);
    assert.deepEqual(await done.b.takeDaily()!, { key: "daily" });

    const notDone = setup();
    notDone.b.start();
    notDone.b.setOnboardingCompleted(false);
    assert.equal(notDone.b.takeDaily(), null);
    assert.equal(notDone.b.take("daily"), null); // 버려졌으므로 다시 가져갈 수도 없다

    const unknown = setup();
    unknown.b.start();
    assert.equal(unknown.b.takeDaily(), null);
  });
  test("낡은 뒤에 start()를 다시 부르면 새로 출발한다", async () => {
    const { b, calls, advance } = setup();
    b.start();
    await new Promise((r) => setTimeout(r, 0));
    advance(BOOT_MAX_AGE_MS + 1);
    b.start();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(calls.length, 8);
  });
});
