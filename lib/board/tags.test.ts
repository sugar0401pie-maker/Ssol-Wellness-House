import { test } from "node:test";
import assert from "node:assert/strict";
import { MAIN_TAGS, TAGS_PER_POST, mainTags, splitTags, tagsFor } from "./tags.ts";
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

test("주요 태그 5개는 그 글만의 태그 앞에서부터, 나머지는 접힘으로", () => {
  const t = tagsFor("post", 1);
  assert.deepEqual(mainTags(t), ["처녀자리", "별자리", "별자리성격", "점성술", "완벽주의"]);
  const { main, rest } = splitTags(t);
  assert.equal(main.length, MAIN_TAGS);
  assert.equal(main.length + rest.length, t.length); // 접어도 태그는 모두 남는다(검색에 걸림)
  assert.ok(rest.includes("고민상담"));
  for (const e of STARTER_EPISODES) assert.equal(mainTags(tagsFor("post", e.n)).length, MAIN_TAGS, `${e.n}화`);
  assert.deepEqual(mainTags(["고민상담", "a"]), ["a"]);
  assert.deepEqual(mainTags(["고민상담", "위로"]), ["고민상담", "위로"]);
});
