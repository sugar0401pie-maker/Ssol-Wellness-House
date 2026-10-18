import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildClaims, buildScenes } from "./claims.ts";

// 기준 파일: CSO 시험용 JSON(claims_v0.1.json)에서 뽑은 13개 claim의 기대 결과 + 그 claim을 만든 DB 표 행
const fx = JSON.parse(fs.readFileSync(new URL("./__fixtures__/claims_fixture.json", import.meta.url), "utf8"));

test("DB 표 행 → 분류기 데이터 변환이 CSO 시험용 JSON과 정확히 같다(13개 claim)", () => {
  const byId = (a: { claim_id: string }, b: { claim_id: string }) => a.claim_id.localeCompare(b.claim_id);
  const got = buildClaims(fx.claims, fx.claimRoots, fx.options, fx.roots).sort(byId);
  assert.deepEqual(got, [...fx.expectedClaims].sort(byId));
});

test("뿌리 대표 claim(generic)은 점수 0.5 · 성격 '주/부' 표기 · 신호 id 목록을 가진다", () => {
  const got = buildClaims(fx.claims, fx.claimRoots, fx.options, fx.roots);
  const g = got.find((c) => c.claim_id === "R-ROOT-10")!;
  assert.equal(g.generic, true);
  assert.equal(g.points, 0.5);
  assert.match(g.nature ?? "", /\//); // 예: "소진/주의"
  assert.ok(Array.isArray(g.signal_ids));
});

test("세부 claim은 generic·points가 없고, 🔸 claim은 show_if 문구를 유지한다", () => {
  const got = buildClaims(fx.claims, fx.claimRoots, fx.options, fx.roots);
  const c = got.find((x) => x.claim_id === "C48-SEEN-LESS")!;
  assert.equal(c.generic, undefined);
  assert.equal(c.points, undefined);
  assert.ok(got.find((x) => x.show_if)?.show_if);
});

test("장면 변환이 CSO JSON과 같다(키·이름·첫 카드·열리는 말)", () => {
  assert.deepEqual(buildScenes(fx.scenes), fx.expectedScenes);
});

test("보기 목록은 정렬되어 항상 같은 순서다", () => {
  const got = buildClaims(fx.claims, fx.claimRoots, [...fx.options].reverse(), fx.roots);
  for (const c of got) assert.deepEqual(c.options, [...c.options].sort());
});
