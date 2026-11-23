import { test } from "node:test";
import assert from "node:assert/strict";
import { dequantize, quantize } from "./embedQuant.ts";

// 임베딩과 비슷한 모양(작은 값이 고르게 퍼진 1,536차원 단위 벡터)을 고정 씨앗으로 만든다.
function rand(seed: number) { let s = seed; return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648) - 0.5; }
function unit(seed: number, dims = 1536) { const r = rand(seed); const v = Array.from({ length: dims }, r); const n = Math.hypot(...v); return v.map((x) => x / n); }
const cos = (a: number[], b: number[]) => { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return d / Math.sqrt(na * nb); };

test("작게 저장했다 되돌려도 방향이 거의 같다(자기 자신과 비슷함 0.999 이상)", () => {
  const v = unit(7);
  const back = dequantize(quantize(v))!;
  assert.equal(back.length, 1536);
  assert.ok(cos(v, back) > 0.999);
});

test("두 문장의 비슷함(코사인) 차이가 0.005 안쪽이라 후보 순위가 바뀌지 않는다", () => {
  const q = unit(1);
  const items = Array.from({ length: 40 }, (_, i) => { const u = unit(100 + i); return u.map((x, k) => x + q[k] * (i / 40)); });
  const exact = items.map((v) => cos(q, v));
  const approx = items.map((v) => cos(q, dequantize(quantize(v))!));
  for (let i = 0; i < items.length; i++) assert.ok(Math.abs(exact[i] - approx[i]) < 0.005);
  const rank = (xs: number[]) => xs.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]).slice(0, 3).map((x) => x[1]);
  assert.deepEqual(rank(approx), rank(exact));
});

test("깨진 줄(길이·배율이 이상함)은 쓰지 않는다", () => {
  const r = quantize(unit(3));
  assert.equal(dequantize({ ...r, dims: 10 }), null);
  assert.equal(dequantize({ ...r, scale: 0 }), null);
  assert.equal(quantize([0, 0, 0]).scale, 1);
});
