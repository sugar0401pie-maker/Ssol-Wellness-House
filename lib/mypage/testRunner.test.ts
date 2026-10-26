import { test } from "node:test";
import assert from "node:assert/strict";
import { runTestProviders, type TestProvider } from "./testRunner.ts";
import type { TestResultItem } from "./testTypes.ts";

const item = (id: string): TestResultItem => ({
  id,
  createdAt: "2026-10-17T00:00:00Z",
  title: id,
  open: { label: "열기", href: "/x", external: false },
});

function provider(key: string, load: TestProvider<null>["load"]): TestProvider<null> {
  return { key, title: key, emptyMessage: "없음", start: { label: "시작", href: "https://example.invalid" }, load };
}

test("등록한 순서대로 그룹이 나오고 종류별 결과가 담긴다", async () => {
  const groups = await runTestProviders(
    [provider("a", async () => [item("a1")]), provider("b", async () => [])],
    null,
  );
  assert.deepEqual(groups.map((g) => g.key), ["a", "b"]);
  assert.equal(groups[0].items?.length, 1);
  assert.deepEqual(groups[1].items, []);
});

test("한 종류가 실패해도 그 종류만 null(불러오지 못함)이고 나머지는 그대로다", async () => {
  const groups = await runTestProviders(
    [
      provider("ok", async () => [item("o1")]),
      provider("broken", async () => {
        throw new Error("boom");
      }),
    ],
    null,
  );
  assert.equal(groups[0].items?.length, 1);
  assert.equal(groups[1].items, null);
});

test("새 테스트 종류를 하나 더 등록하면 같은 방식으로 그룹이 늘어난다", async () => {
  const base = [provider("dessert", async () => [item("d")]), provider("astro", async () => [item("s")])];
  const withNew = [...base, provider("future-test", async () => [item("f")])];
  const groups = await runTestProviders(withNew, null);
  assert.deepEqual(groups.map((g) => g.key), ["dessert", "astro", "future-test"]);
});

test("같은 key를 두 번 등록하면 실수로 보고 막는다", async () => {
  await assert.rejects(
    runTestProviders([provider("x", async () => []), provider("x", async () => [])], null),
    /중복/,
  );
});
