import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutCloud } from "./cloud.ts";
import { STARTER_GUIDES, SCORES, scoreOf, type Basis } from "./data.ts";

test("글자 구름: 4가지 기준 모두 겹치지 않고 상자 밖으로 나가지 않는다", () => {
  for (const basis of Object.keys(SCORES) as Basis[]) {
    const items = STARTER_GUIDES.map((g) => ({ key: g.slug, label: `#${g.tag}`, score: scoreOf(basis, g.tag) }));
    const pos = layoutCloud(items, 88, 66);
    const boxes = Object.values(pos);
    assert.equal(boxes.length, 11);
    for (const b of boxes) assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= 88 && b.y + b.h <= 66, `${basis} 밖으로`);
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const c = boxes[j];
        assert.ok(a.x + a.w <= c.x || c.x + c.w <= a.x || a.y + a.h <= c.y || c.y + c.h <= a.y, `${basis} 겹침`);
      }
  }
});

test("점수표: 11개 태그 모두 4가지 기준에 1~5점", () => {
  for (const basis of Object.keys(SCORES) as Basis[]) for (const g of STARTER_GUIDES) assert.ok(SCORES[basis][g.tag] >= 1 && SCORES[basis][g.tag] <= 5, `${basis} ${g.tag}`);
});
