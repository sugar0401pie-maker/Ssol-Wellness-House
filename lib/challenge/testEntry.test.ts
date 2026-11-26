import { test } from "node:test";
import assert from "node:assert/strict";
import { isTestEntryTarget, testEntryTarget } from "./testEntry.ts";

const R = "0b9f2c1e-3a4d-4c5e-8f60-123456789abc";

test("쏠 타로 챌린지 주소 → 그 결과의 챌린지 화면", () => {
  assert.equal(testEntryTarget("/challenge", `?from=tarot&result=${R}`), `/challenge/start/tarot?result=${R}`);
  assert.equal(testEntryTarget("/challenge/", `?from=tarot&result=${R.toUpperCase()}`), `/challenge/start/tarot?result=${R}`);
  assert.equal(testEntryTarget("/challenge", "?from=tarot&result=x;drop"), "/challenge/start/tarot");
});

test("예전 주소(마음 키)와 풍등", () => {
  assert.equal(testEntryTarget("/challenge", "?theme=delay"), "/challenge/start/delay?from=test");
  assert.equal(testEntryTarget("/challenge/start/energy", "?from=test"), "/challenge/start/energy?from=test");
  assert.equal(testEntryTarget("/lantern", `?from=tarot&result=${R}`), "/lantern");
});

test("테스트에서 온 주소가 아니면 null", () => {
  assert.equal(testEntryTarget("/challenge", ""), null);
  assert.equal(testEntryTarget("/challenge/start/me", "?from=test"), null);
  assert.equal(testEntryTarget("/lantern", ""), null);
  assert.equal(testEntryTarget("/home", "?from=tarot"), null);
});

test("맡아 둔 값은 정해진 모양만", () => {
  assert.ok(isTestEntryTarget(`/challenge/start/tarot?result=${R}`));
  assert.ok(isTestEntryTarget("/challenge/start/worry?from=test"));
  assert.ok(isTestEntryTarget("/lantern"));
  assert.ok(!isTestEntryTarget("https://evil.example/challenge"));
  assert.ok(!isTestEntryTarget("//evil.example"));
  assert.ok(!isTestEntryTarget("/challenge/start/tarot?result=x"));
});
