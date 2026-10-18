import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClaimIndex, claimTexts, scoreClaims } from "./search.ts";
import type { Claim } from "./claims.ts";

const claim = (id: string, label: string, examples: string[] = []): Claim => ({
  claim_id: id, label, kind: "마음", roots: [], options: [], scenes: [], examples, lean: [], counter: [], core_thoughts: [], show_if: null,
});
// 가짜 임베딩: 문장에 들어 있는 낱말로 방향이 정해지는 3차원 벡터(운동 / 사람 / 일)
const fake = async (texts: string[]) => texts.map((t) => [/운동|공/.test(t) ? 1 : 0, /사람|만나/.test(t) ? 1 : 0, /일|회사/.test(t) ? 1 : 0].map((x, i) => x + (i === 0 ? 0.001 : 0)));

test("claim의 대표 문장은 이름·예시·기우는 말·기저 생각을 모은 것이다", () => {
  const c = { ...claim("A", "이름", ["예시1"]), lean: ["기움"], core_thoughts: ["생각"] };
  assert.deepEqual(claimTexts(c), ["이름", "예시1", "기움", "생각"]);
});

test("발화와 가장 가까운 문장이 있는 claim의 점수가 높다(문장별 최댓값)", async () => {
  const idx = await buildClaimIndex([claim("SPORT", "운동이 싫어요", ["공이 무서워요"]), claim("PEOPLE", "사람 만나면 지쳐요"), claim("WORK", "일이 많아요", ["회사 야근"])], fake);
  const s = scoreClaims((await fake(["공 오면 도망가요"]))[0], idx).sort((a, b) => b.sim - a.sim);
  assert.equal(s[0].claim_id, "SPORT");
  assert.ok(s[0].sim > 0.9 && s[2].sim < 0.1);
});

test("한 번에 보내는 개수를 넘으면 나눠서 부르고 순서를 지킨다", async () => {
  const calls: number[] = [];
  const embed = async (t: string[]) => { calls.push(t.length); return t.map(() => [1, 0, 0]); };
  const claims = Array.from({ length: 7 }, (_, i) => claim("C" + i, "문장" + i));
  const idx = await buildClaimIndex(claims, embed, 3);
  assert.deepEqual(calls, [3, 3, 1]);
  assert.equal(idx.owners.length, 7);
});

test("임베딩 개수가 요청과 다르면 오류(조용히 어긋나지 않게)", async () => {
  await assert.rejects(buildClaimIndex([claim("A", "하나"), claim("B", "둘")], async () => [[1, 0, 0]]), /개수/);
});
