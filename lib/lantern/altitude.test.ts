import { test } from "node:test";
import assert from "node:assert/strict";
import { ALTITUDE_LINES, MOON_KM, altitudeKm, formatKm, pickAltitudeLine, renderAltitudeLine } from "./altitude.ts";

test("높이: 날린 시각부터 시속 600km로 계속 올라간다(시각이 이상하면 1km)", () => {
  const at = "2026-11-26T00:00:00Z";
  const t0 = Date.parse(at);
  assert.equal(altitudeKm(at, t0), 1);
  assert.equal(altitudeKm(at, t0 + 3_600_000), 601);
  assert.equal(altitudeKm(at, t0 + 14 * 24 * 3_600_000), 201_601);
  assert.equal(altitudeKm(at, t0 - 1000), 1);
  assert.equal(altitudeKm("bad", t0), 1);
  assert.equal(formatKm(203001), "203,001km");
});

test("문장은 그 높이에 맞는 것만 — 모든 높이에 쓸 문장이 있고, 성층권 문장이 달 너머에 나오지 않는다", () => {
  for (const km of [1, 11, 12, 49, 50, 99, 100, 399, 400, 35_999, 36_000, MOON_KM - 1, MOON_KM, 2_000_000]) {
    for (const r of [0, 0.3, 0.6, 0.99, 1]) {
      const l = pickAltitudeLine(km, r);
      assert.ok(l && km >= l.min && km < l.max, `${km} ${r}`);
    }
  }
  assert.ok(!pickAltitudeLine(500_000, 0).text.includes("성층권"));
  assert.ok(ALTITUDE_LINES.every((l) => l.text.startsWith("{who} 풍등은") && l.text.includes("{km}")));
});

test("이름이 있으면 '○○님의', 없으면 '당신의' — 자리표시가 남지 않는다", () => {
  const line = ALTITUDE_LINES.find((l) => l.text.includes("{pct}"))!;
  const s = renderAltitudeLine(line, 192_200, "과곽이");
  assert.equal(s, "과곽이님의 풍등은 지금 192,200km 상공, 달까지 가는 길의 50%를 지났어요.");
  const t = renderAltitudeLine(ALTITUDE_LINES[4], 60, "  ");
  assert.equal(t, "당신의 풍등은 지금 성층권을 지나 60km 상공에 가고 있어요.");
  for (const l of ALTITUDE_LINES) assert.ok(!/[{}]/.test(renderAltitudeLine(l, 1000, "가")));
});

test("두 문장짜리 높이 문장은 두 번째 문장에서 줄을 바꾼다(대표님 2026-11-26)", () => {
  const two = ALTITUDE_LINES.filter((l) => l.text.includes("아직 올라가고 있어요"));
  assert.equal(two.length, 1);
  assert.equal(renderAltitudeLine(two[0], 937, "과곽이"), "과곽이님의 풍등은 소원을 품은 채 937km 상공을 지나는 중이에요.\n아직 올라가고 있어요.");
});
