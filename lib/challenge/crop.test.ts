import { test } from "node:test";
import assert from "node:assert/strict";
import { CROP_DEFAULT, clampCrop, cropRect } from "./crop.ts";

test("기본은 가운데를 정사각형으로 — 짧은 변이 꽉 차요", () => {
  const r = cropRect(CROP_DEFAULT, 4000, 3000, 720);
  assert.equal(r.dh, 720);
  assert.equal(r.dw, 960);
  assert.equal(r.x, -120);
  assert.equal(r.y, 0);
});

test("옮겨도 빈 곳이 생기지 않게 제한, 확대는 1~3배", () => {
  const k = clampCrop({ zoom: 1, ox: 5, oy: 5 }, 4000, 3000);
  assert.ok(Math.abs(k.ox - 1 / 6) < 1e-9);
  assert.equal(k.oy, 0);
  assert.equal(clampCrop({ zoom: 9, ox: 0, oy: 0 }, 100, 100).zoom, 3);
  assert.equal(clampCrop({ zoom: 0, ox: 0, oy: 0 }, 100, 100).zoom, 1);
  const r = cropRect({ zoom: 1, ox: 5, oy: 0 }, 4000, 3000, 720);
  assert.ok(Math.abs(r.x) < 1e-9); // 왼쪽 끝까지 — 빈 곳 없음
});
