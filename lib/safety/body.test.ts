import test from "node:test";
import assert from "node:assert/strict";
import { bodySignals, hasBodyStage } from "./body.ts";

test("B-a: 지속 표현 + 잠이 흔들림이 함께 있을 때만", () => {
  assert.deepEqual(bodySignals("요즘 계속 새벽 4시에 깨요"), ["B-a"]);
  assert.deepEqual(bodySignals("몇 주째 잠을 못 자요"), ["B-a"]);
  assert.deepEqual(bodySignals("며칠째 잠이 안 와요"), ["B-a"]);
});
test("B-a: 하루 이틀의 일시적 수면 변화(지속 표현 없음)는 세지 않는다", () => {
  assert.deepEqual(bodySignals("어제 발표 때문에 잠을 못 잤어요"), []);
  assert.deepEqual(bodySignals("시험 전날이라 뒤척였어요"), []);
});
test("B-b: 몸이 계속 아픔(본인이 말함)", () => {
  assert.deepEqual(bodySignals("몇 주째 두통이 안 떨어져요"), ["B-b"]);
  assert.deepEqual(bodySignals("계속 몸이 안 좋아요"), ["B-b"]);
});
test("B-b: 지속 표현 없는 한 번의 통증은 세지 않는다", () => {
  assert.deepEqual(bodySignals("오늘 머리가 좀 아파요"), []);
});
test("B-c: 쉬어도 몸이 안 풀림", () => {
  assert.deepEqual(bodySignals("주말 내내 누워 있어도 몸이 안 풀려요"), ["B-c"]);
  assert.deepEqual(bodySignals("몸이 안 따라 줘요"), ["B-c"]);
});
test("일상 말과 마음 이야기는 몸 단계가 아니다", () => {
  for (const t of ["오늘 회의가 길어서 지쳤어요", "친구랑 다퉈서 속상해요", "운동을 시작해 보고 싶어요", ""]) assert.deepEqual(bodySignals(t), [], t);
});
test("hasBodyStage: 최근 말 중 하나라도 있으면 true, 비면 false", () => {
  assert.equal(hasBodyStage(["안녕하세요", "요즘 계속 새벽에 깨요"]), true);
  assert.equal(hasBodyStage(["안녕하세요"]), false);
  assert.equal(hasBodyStage([]), false);
});
