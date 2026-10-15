import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_VARIANT_COUNT, VARIANT_COUNTS, variantCount, variantFor } from "./variants.ts";

const ALL_TYPES = ["brownie", "tiramisu", "affogato", "shortcake", "berrycheesecake", "berrysorbet", "millefeuille", "macaron", "meringue", "basquecake", "madeleine", "castella", "croissant", "lemontart", "fruittart"];
const root = join(import.meta.dirname, "..", "..", "public", "characters");

describe("캐릭터 변형", () => {
  test("장수 표에 없는 유형은 기본 5장", () => {
    assert.equal(variantCount("tiramisu"), DEFAULT_VARIANT_COUNT);
    assert.equal(variantCount(undefined), DEFAULT_VARIANT_COUNT);
    assert.equal(variantCount("meringue"), 6);
  });
  test("난수 0~1을 1~장수 사이 번호로 바꾸고, 경계(0, 1 이상)에서도 범위를 벗어나지 않는다", () => {
    assert.equal(variantFor("meringue", 0), 1);
    assert.equal(variantFor("meringue", 0.999999), 6);
    assert.equal(variantFor("meringue", 1), 6);
    assert.equal(variantFor("meringue", 5), 6);
    assert.equal(variantFor("meringue", -1), 1);
    assert.equal(variantFor("tiramisu", 0.999999), 5);
  });
  test("모든 번호가 고르게 나올 수 있다(6장 유형 600번 뽑으면 각 번호가 나온다)", () => {
    const seen = new Set<number>();
    for (let k = 0; k < 600; k++) seen.add(variantFor("meringue", k / 600));
    assert.deepEqual([...seen].sort(), [1, 2, 3, 4, 5, 6]);
  });
  test("15개 유형 모두, 장수 표(없으면 5장)만큼 그림 파일이 실제로 있다 — 없는 번호가 뽑혀 그림이 깨지는 일을 막는다", () => {
    for (const code of ALL_TYPES) {
      for (let v = 1; v <= variantCount(code); v++) assert.ok(existsSync(join(root, code, `${v}.png`)), `${code}/${v}.png 없음`);
    }
  });
  test("표에 적힌 유형은 모두 실제 유형 코드이고, 표의 장수보다 파일이 더 많이 남아 있지 않다", () => {
    for (const code of Object.keys(VARIANT_COUNTS)) assert.ok(ALL_TYPES.includes(code), `알 수 없는 유형 ${code}`);
    for (const code of ALL_TYPES) assert.equal(existsSync(join(root, code, `${variantCount(code) + 1}.png`)), false, `${code}에 표에 없는 그림이 있음`);
  });
});
