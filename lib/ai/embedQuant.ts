// 임베딩 벡터를 DB에 작게 저장하는 순수 함수(2026-11-23, AI 비용 줄이기 1번 — lib/ai/embedCache.ts).
// 1,536개 소수를 그대로 두면 한 줄에 약 20KB라 서버가 켜질 때 2,500줄을 읽는 게 오히려 느리다.
// 벡터마다 가장 큰 절댓값으로 나눠 -127~127 정수(1바이트)로 바꾸고 base64로 둔다(한 줄 약 2KB). 비슷함(코사인) 차이는 0.001 안팎이라 순위에 영향이 없다(embedQuant.test.ts).
// "server-only"를 넣지 않는다(테스트가 바로 읽는다).

export type QuantRow = { dims: number; scale: number; q: string };

export function quantize(v: ArrayLike<number>): QuantRow {
  let m = 0;
  for (let i = 0; i < v.length; i++) m = Math.max(m, Math.abs(v[i]));
  const scale = m || 1;
  const out = new Int8Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = Math.max(-127, Math.min(127, Math.round((v[i] / scale) * 127)));
  return { dims: v.length, scale, q: Buffer.from(out.buffer, out.byteOffset, out.byteLength).toString("base64") };
}

export function dequantize(r: QuantRow): number[] | null {
  const b = Buffer.from(r.q, "base64");
  if (b.length !== r.dims || !(r.scale > 0)) return null; // 깨진 줄은 쓰지 않는다(다시 만든다)
  const i8 = new Int8Array(b.buffer, b.byteOffset, b.byteLength);
  const out = new Array<number>(r.dims);
  for (let i = 0; i < r.dims; i++) out[i] = (i8[i] / 127) * r.scale;
  return out;
}
