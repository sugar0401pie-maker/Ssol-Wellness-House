import { test } from "node:test";
import assert from "node:assert/strict";
import { maskDirectHealth, maskEvents, MASK } from "./healthMask.ts";

const m = (t: string) => maskDirectHealth(t).text;

test("병명·진단·약·병원이 들어 있는 어절을 가리고, 감정 부분은 남긴다", () => {
  assert.equal(m("당뇨 진단받고 나서 계속 우울해요"), `${MASK} 나서 계속 우울해요`);
  assert.equal(m("항우울제를 먹고 있어서 낮에 졸리고 기분이 가라앉아요"), `${MASK} 먹고 있어서 낮에 졸리고 기분이 가라앉아요`);
  assert.equal(m("병원에 다녀왔는데 마음이 무거워요"), `${MASK} 다녀왔는데 마음이 무거워요`);
  assert.equal(m("감기에 걸려서 계속 피곤하고 처지네요"), `${MASK} 걸려서 계속 피곤하고 처지네요`);
  assert.match(m("암 투병 중인 엄마를 보니 마음이 아파요"), /^\[건강\]/);
  assert.match(m("갑상선 수치가 안 좋대서 걱정이 돼요"), /^\[건강\]/);
});

test("가렸는지 여부(masked)를 알려 준다", () => {
  assert.equal(maskDirectHealth("공황장애 때문에 힘들어요").masked, true);
  assert.equal(maskDirectHealth("요즘 힘들어요").masked, false);
});

test("건강 직접 정보가 아닌 말은 건드리지 않는다 — 감정·컨디션·증상 표현·비슷한 글자", () => {
  for (const t of [
    "요즘 너무 우울해요", "몸이 안 좋아서 요즘 계속 피곤하고 의욕이 없어요", "허리가 아파서 운동을 못 하니 기분이 처져요", "돈 걱정 때문에 잠이 잘 안 와요",
    "일이 너무 많아서 번아웃이 온 것 같아요", "암기가 안 돼서 시험이 걱정이에요", "분위기가 암울해요", "약속을 잊어버려서 속상해요", "약간 불안해요",
    "주사위를 던지듯 결정해요", "마음이 아파요", "슬프고 지쳐요", "오후만 되면 눈이 감기고 졸려요", "부모님 병원비를 제가 챙겨요",
  ]) assert.equal(m(t), t, t);
});

test("약을 먹는다는 말은 어절 전체(혈압약을 먹고)를 가린다", () => {
  assert.equal(m("혈압약을 먹고 나면 졸려서 기분이 쳐져요"), `${MASK} 나면 졸려서 기분이 쳐져요`);
});

test("연달아 가려진 부분은 하나로 합친다", () => {
  assert.equal(m("불면증 진단 받아서 병원 다녀요 그래서 슬퍼요"), `${MASK} 다녀요 그래서 슬퍼요`);
});

test("장부 사건은 evidence만 가리고 점수·claim·확신도는 그대로", () => {
  const ev = [{ op: "apply", event_id: "e1", claim_id: "C1", points: 1, confidence: 0.9, evidence: "당뇨 진단받고 나서 계속 우울해요" }, { op: "apply", event_id: "e2", claim_id: "C2", points: 1, confidence: 0.8 }];
  const out = maskEvents(ev);
  assert.equal(out[0].evidence, `${MASK} 나서 계속 우울해요`);
  assert.equal(out[0].points, 1);
  assert.equal(out[0].claim_id, "C1");
  assert.equal(out[1].evidence, undefined);
});
