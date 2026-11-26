import { test } from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS, pruneRetiredRanked } from "./schema.ts";

const opts = (id: string) => (QUESTIONS.find((q) => q.id === id)?.options ?? []).map(([c]) => c);

test("CSO 묶음 v2.40 온보딩 보기: closer_partner·travel_nature 있음, family_time 없음", () => {
  assert.ok(opts("values_ranked").includes("closer_partner"));
  assert.ok(!opts("values_ranked").includes("family_time"));
  assert.ok(opts("hobbies_ranked").includes("travel_nature"));
});

test("보관된 보기를 고른 예전 답은 수정 화면에서 빠지고 순위가 다시 매겨진다", () => {
  const out = pruneRetiredRanked({
    values_ranked: [{ key: "family_time", rank: 1 }, { key: "friendships", rank: 2 }, { key: "life_meaning", rank: 3 }],
    relationship_status: "single",
  });
  assert.deepEqual(out.values_ranked, [{ key: "friendships", rank: 1 }, { key: "life_meaning", rank: 2 }]);
  assert.equal(out.relationship_status, "single");
});
