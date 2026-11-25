import { test } from "node:test";
import assert from "node:assert/strict";
import { BOWLS, OTTER_K, POSES, H, W, hitArea, nextAutoBowl, posePlacement } from "./layout.ts";

test("해달은 채 끝 기준 2.7배 — 키워도 채 끝 자리(rc)가 그대로", () => {
  for (const n of [1, 2, 3, 5]) {
    const p = posePlacement(n);
    const [x, y, w, h] = POSES[n].rect;
    const [cx, cy] = POSES[n].rc;
    // 그림 안에서 rc가 차지하는 비율 위치는 키운 뒤에도 같은 점에 놓인다(당기지 않은 경우)
    const fx = (cx - x) / w;
    const fy = (cy - y) / h;
    assert.ok(Math.abs(p.left + fx * p.width - (cx / W) * 100) < 1e-6, `x ${n}`);
    assert.ok(Math.abs(p.top + fy * ((h * OTTER_K) / H) * 100 - (cy / H) * 100) < 1e-6, `y ${n}`);
  }
});

test("화면 밖으로 나가는 자세는 안쪽으로 당긴다(0~100%)", () => {
  for (const n of [1, 2, 3, 4, 5]) {
    const p = posePlacement(n);
    assert.ok(p.left >= 0 && p.left + p.width <= 100 + 1e-9, `${n}`);
  }
  assert.equal(posePlacement(4).left, 0);
});

test("누르는 영역은 보울보다 위·아래·옆으로 10씩 넓다, 보울 번호는 왼쪽부터", () => {
  const a = hitArea(BOWLS[0]);
  assert.ok(Math.abs(a.left - (38 / W) * 100) < 1e-9);
  assert.ok(Math.abs(a.width - (139 / W) * 100) < 1e-9);
  assert.deepEqual(BOWLS.map((b) => b.id), [1, 2, 3, 4, 5]);
  assert.ok(BOWLS.every((b, i) => i === 0 || b.rect[0] > BOWLS[i - 1].rect[0]));
});

test("알아서 울리기는 바로 전 보울을 다시 고르지 않는다", () => {
  for (const r of [0, 0.2, 0.5, 0.99, 1]) for (const last of [1, 3, 5]) assert.notEqual(nextAutoBowl(last, r), last);
  assert.equal(nextAutoBowl(null, 0), 1);
});
