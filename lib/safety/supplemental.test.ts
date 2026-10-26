// SAFE-018~021 · V1·V2 판단 테스트. 예시 문장은 전문위원 검수 묶음 v0.7(1-2 분류 기준, 1-4 안전 신호)의 포함·확인·제외 예시를 그대로 썼다.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { canSoftenDrunkDriving, detectGuidanceTopics, guidanceBlock, overdoseNow, perceptionRepeated, psychoticCertainty, supplementalHits, SUPPRESS_OFFERS } from "./supplemental.ts";

const routes = (t: string) => supplementalHits(t).map((h) => `${h.ruleId}:${h.route}`);

describe("V1·V2 폭력 즉시 판정(SAFE-001)", () => {
  test("포함(🔴)", () => {
    for (const t of ["남친이 화나면 벽을 치고 물건을 던져서 무서워요", "화나면 벽을 쳐서 무서워요", "헤어지자고 하면 죽어버리겠다고 해요", "헤어지면 가만 안 두겠다고 해요", "남편한테 맞아서 멍이 들었어요"]) {
      assert.ok(routes(t).includes("SAFE-001:violence"), t);
    }
  });
  test("일상 말은 걸리지 않는다", () => {
    for (const t of ["일을 때려치우고 싶어요", "멍 때리고 있었어요", "엄마가 잔소리가 심해서 짜증 나요", "친구랑 말다툼해서 서먹해요", "남친이 연락을 자주 해서 좋아요", "팀장님 눈치를 많이 보는 편이에요", "공을 던지며 놀았어요"]) {
      assert.deepEqual(routes(t), [], t);
    }
  });
});

describe("SAFE-020 감시·조종·생각 읽힘 확신(🔴)", () => {
  test("포함", () => {
    for (const t of ["윗집 사람들이 제 머릿속 생각을 다 읽고 있어요. 확실해요", "누가 휴대폰으로 저를 감시하고 조종하고 있어요"]) {
      assert.equal(psychoticCertainty(t), true, t);
      assert.ok(routes(t).includes("SAFE-020:crisis"), t);
    }
  });
  test("제외 — 일상 말·소문·관계 고민·비유·과거·남 이야기·작품", () => {
    for (const t of ["회사가 메신저를 다 감시한대요, 말 조심해야 해요", "엄마가 제 일정을 너무 조종하려고 해요", "요즘 너무 지쳐서 멍하고 현실감이 없어요", "팀장 목소리가 꿈에서도 들려요 ㅋㅋ", "회사 사람들이 다 제 뒷담화하는 것 같아요", "예전에 공황 왔을 때 비현실감이 있었어요", "친구가 조현병 진단을 받았대요", "드라마에서 환청 듣는 장면이 너무 무서웠어요", "직감이 와요, 이건 운명 같아요", "남편이 제 휴대폰을 감시하고 있어요"]) {
      assert.equal(psychoticCertainty(t), false, t);
      assert.ok(!routes(t).includes("SAFE-020:crisis"), t);
    }
  });
});

describe("SAFE-021 약 과다복용(🔴) · 술·약 지침", () => {
  test("과다복용 포함", () => {
    for (const t of ["방금 수면제를 한 통 다 먹었어요", "약을 한꺼번에 먹었어요"]) {
      assert.equal(overdoseNow(t), true, t);
      assert.ok(routes(t).includes("SAFE-021:crisis"), t);
    }
  });
  test("과다복용 제외", () => {
    for (const t of ["수면제 먹으면 내일 출근 괜찮을까요?", "예전에 수면제를 한꺼번에 먹었던 적이 있어요", "어제 회식에서 과음해서 머리 아파요", "스트레스 받으면 맥주 한 캔 마셔요", "아빠가 술을 너무 많이 드세요"]) {
      assert.equal(overdoseNow(t), false, t);
      assert.deepEqual(routes(t), [], t);
    }
  });
  test("의존·금단은 줄이는 쪽 지침(🟡)", () => {
    assert.ok(detectGuidanceTopics("술 없으면 하루도 못 버텨요. 안 마시면 손이 떨려요").includes("substance_dependence"));
    assert.ok(detectGuidanceTopics("요즘 술이 좀 늘었나 싶어요").includes("substance_dependence"));
    assert.deepEqual(detectGuidanceTopics("스트레스 받으면 맥주 한 캔 마셔요"), []);
    assert.deepEqual(detectGuidanceTopics("어제 회식에서 과음해서 머리 아파요"), []);
  });
  test("음주운전·과음 상태", () => {
    assert.ok(detectGuidanceTopics("술 마시고 운전해서 그냥 끝내고 싶어요").includes("drunk_driving"));
    assert.ok(detectGuidanceTopics("소주 몇 병째인지 모르겠어요 지금 너무 어지러워요").includes("heavily_drunk"));
  });
});

describe("SAFE-018 섭식 · SAFE-019 강박 운동", () => {
  test("섭식 포함 — 구토·설사약·3일 이상 굶음·멈출 수 없는 폭식", () => {
    for (const t of ["먹고 나서 토해요", "사흘째 거의 안 먹었어요", "설사약으로 빼고 있어요", "굶기를 반복하고 있어요", "폭식을 멈출 수가 없었어요 너무 괴로워요"]) {
      assert.ok(detectGuidanceTopics(t).includes("eating"), t);
    }
  });
  test("섭식 제외 — 한 끼 거름·일상·다른 증상", () => {
    for (const t of ["어제 한 끼 굶었어요", "오늘 점심을 많이 먹어서 저녁은 건너뛸래요", "며칠째 밥이 안 넘어가요", "예전에 폭식했던 적이 있어요", "드라마에서 먹고 토하는 장면을 봤어요"]) {
      assert.ok(!detectGuidanceTopics(t).includes("eating"), t);
    }
  });
  test("강박 운동", () => {
    assert.ok(detectGuidanceTopics("발목 다쳤는데 못 쉬겠어요 운동을 멈출 수 없어요").includes("compulsive_exercise"));
    assert.deepEqual(detectGuidanceTopics("오늘 운동하고 왔어요"), []);
  });
});

describe("SAFE-020 현실감·지각 확인(🟠, 한 번으로 판단하지 않음)", () => {
  test("확인 대상", () => {
    for (const t of ["지금도 아무도 없는데 누가 제 욕을 하는 목소리가 계속 들려요", "요 며칠 세상이 다 가짜 같고 저만 다른 데 있는 것 같아서 무서워요"]) {
      assert.ok(detectGuidanceTopics(t).includes("perception"), t);
    }
  });
  test("제외", () => {
    for (const t of ["요즘 너무 지쳐서 멍하고 현실감이 없어요", "팀장 목소리가 꿈에서도 들려요 ㅋㅋ", "예전에 공황 왔을 때 비현실감이 있었어요"]) {
      assert.ok(!detectGuidanceTopics(t).includes("perception"), t);
    }
  });
  test("두 번 이상 나오면 진료 안내 문장이 붙는다", () => {
    const a = "지금도 아무도 없는데 누가 제 욕을 하는 목소리가 계속 들려요";
    assert.equal(perceptionRepeated(a, []), false);
    assert.equal(perceptionRepeated(a, ["요 며칠 세상이 다 가짜 같고 저만 다른 데 있는 것 같아서 무서워요"]), true);
    assert.doesNotMatch(guidanceBlock(["perception"]) ?? "", /정신건강복지센터/);
    assert.match(guidanceBlock(["perception"], { perceptionRepeated: true }) ?? "", /정신건강복지센터/);
  });
});

describe("지침 블록 원칙", () => {
  test("휴먼 웰니스 세션을 권하지 않고, '~할 수 없어요' 거절 표현이 없다", () => {
    const all = guidanceBlock(["eating", "compulsive_exercise", "perception", "substance_dependence", "drunk_driving", "heavily_drunk"], { perceptionRepeated: true }) ?? "";
    assert.doesNotMatch(all, /(할|드릴)\s*수\s*없어요/);
    for (const t of ["eating", "perception"] as const) assert.match(guidanceBlock([t]) ?? "", /휴먼 웰니스 세션을 권하지 마세요/);
  });
  test("섭식·현실감·과음 상태에서는 이론 탐색·실천 추천을 열지 않는다", () => {
    assert.deepEqual([...SUPPRESS_OFFERS].sort(), ["eating", "heavily_drunk", "perception"]);
  });
});

describe("음주운전을 위기·폭력으로 잘못 본 경우만 일반 대화로", () => {
  const cls = { route: "violence", source: "classifier", classifierUnavailable: false };
  test("되돌린다", () => {
    for (const t of ["술 마시고 운전했어요", "술 마시고 운전해서 그냥 끝내고 싶어요"]) assert.equal(canSoftenDrunkDriving(cls, t), true, t);
    assert.equal(canSoftenDrunkDriving({ ...cls, route: "crisis" }, "술 마시고 운전했어요"), true);
  });
  test("자살·자해 의사가 분명하거나 키워드 판정·다른 경로면 그대로 둔다", () => {
    assert.equal(canSoftenDrunkDriving(cls, "술 마시고 운전하다가 죽고 싶어졌어요"), false);
    assert.equal(canSoftenDrunkDriving({ ...cls, source: "keyword+classifier" }, "술 마시고 운전했어요"), false);
    assert.equal(canSoftenDrunkDriving({ ...cls, route: "wellness" }, "술 마시고 운전했어요"), false);
    assert.equal(canSoftenDrunkDriving(cls, "남친이 술 마시고 운전하면서 저를 때려요"), false); // 폭력 즉시 판정 패턴이 있으면 그대로
    assert.equal(canSoftenDrunkDriving(cls, "오늘 점심 뭐 먹을까요"), false);
  });
});
