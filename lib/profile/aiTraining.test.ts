import { test } from "node:test";
import assert from "node:assert/strict";
import { consentFromRow, trainingAllowed } from "./aiTraining.ts";

test("기본은 동의: 값이 true이거나 비어 있으면 허용", () => {
  assert.equal(trainingAllowed({ data: { ai_training_consent: true }, error: null }), true);
  assert.equal(trainingAllowed({ data: {}, error: null }), true);
  assert.equal(trainingAllowed({ data: null, error: null }), true);
});

test("마이페이지에서 거부(false)한 사람은 막는다", () => {
  assert.equal(trainingAllowed({ data: { ai_training_consent: false }, error: null }), false);
  assert.equal(consentFromRow({ ai_training_consent: false }), false);
});

test("칸이 아직 없으면(마이그레이션 전, 42703) 동의로 본다", () => {
  assert.equal(trainingAllowed({ data: null, error: { code: "42703" } }), true);
});

test("그 밖의 읽기 오류는 확인하지 못했으니 거부로 본다(문장 조각을 저장하지 않음)", () => {
  assert.equal(trainingAllowed({ data: null, error: { code: "08006" } }), false);
  assert.equal(trainingAllowed({ data: null, error: {} }), false);
});

test("화면 표시용: 행이 없거나 값이 없으면 동의 상태로 보인다", () => {
  assert.equal(consentFromRow(null), true);
  assert.equal(consentFromRow({}), true);
  assert.equal(consentFromRow({ ai_training_consent: true }), true);
});
