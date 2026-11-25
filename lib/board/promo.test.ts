import { test } from "node:test";
import assert from "node:assert/strict";
import { SOWELLA_DESCS, SOWELLA_HEADLINES, TAROT_DESCS, TAROT_HEADLINES, promoFor, promoIndex } from "./promo.ts";
import { STARTER_EPISODES, STARTER_GUIDES } from "./data.ts";

test("광고 문구는 글마다 다른 조합으로 돌아가며 — 지금 글 21편이 모두 다르고, 모든 문구가 한 번 이상 쓰인다", () => {
  const order = STARTER_GUIDES.map((g) => g.slug);
  const keys = [...STARTER_EPISODES.map((e) => promoIndex("post", e.n, order)), ...STARTER_GUIDES.map((g) => promoIndex("guide", g.slug, order))];
  const combos = keys.map((k) => JSON.stringify(promoFor(k)));
  assert.equal(new Set(combos).size, combos.length);
  const used = keys.map((k) => promoFor(k));
  for (const h of SOWELLA_HEADLINES) assert.ok(used.some((u) => u.sowella.headline === h), h);
  for (const h of TAROT_HEADLINES) assert.ok(used.some((u) => u.tarot.headline === h), h);
  for (const d of [...SOWELLA_DESCS]) assert.ok(used.some((u) => u.sowella.desc === d), d);
  for (const d of [...TAROT_DESCS]) assert.ok(used.some((u) => u.tarot.desc === d), d);
  assert.ok(!TAROT_DESCS.some((d) => d.includes("미래를 보장")));
});
