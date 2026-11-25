import { test } from "node:test";
import assert from "node:assert/strict";
import { TAGS_PER_POST, tagsFor } from "./tags.ts";
import { STARTER_EPISODES, STARTER_GUIDES } from "./data.ts";

test("고민 타파 글마다 서로 다른 태그 40개(공통 + 종류 + 글마다)", () => {
  for (const g of STARTER_GUIDES) {
    const t = tagsFor("guide", g.slug);
    assert.equal(t.length, TAGS_PER_POST, `가이드 ${g.slug}: ${t.length}`);
    assert.equal(new Set(t).size, t.length);
    assert.ok(t.includes("고민가이드"));
  }
  for (const e of STARTER_EPISODES) {
    const t = tagsFor("post", e.n);
    assert.equal(t.length, TAGS_PER_POST, `${e.n}화: ${t.length}`);
    assert.equal(new Set(t).size, t.length);
    assert.ok(t.includes("고민우체국"));
  }
});
