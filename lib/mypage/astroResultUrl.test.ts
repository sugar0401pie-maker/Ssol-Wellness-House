import { test } from "node:test";
import assert from "node:assert/strict";
import { astroResultUrl, ASTRO_SITE_URL } from "./astroResultUrl.ts";

const ID = "0a1b2c3d-4e5f-6789-abcd-ef0123456789";

test("결과 id와 마지막 쪽 번호로 상세 주소를 만든다", () => {
  assert.equal(astroResultUrl(ID, 4), `${ASTRO_SITE_URL}/results/${ID}/4`);
});

test("마지막 쪽 번호가 없거나 이상하면 1쪽으로 연다", () => {
  for (const bad of [null, undefined, 0, -2, 1.5, Number.NaN]) {
    assert.equal(astroResultUrl(ID, bad), `${ASTRO_SITE_URL}/results/${ID}/1`);
  }
});

test("id 형식이 이상하면 주소에 붙이지 않고 점성술 앱의 내 결과 목록으로 보낸다", () => {
  assert.equal(astroResultUrl("../../admin", 1), `${ASTRO_SITE_URL}/results`);
  assert.equal(astroResultUrl("", 1), `${ASTRO_SITE_URL}/results`);
});
