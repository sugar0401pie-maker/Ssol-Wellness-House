import { test } from "node:test";
import assert from "node:assert/strict";
import { ASTRO_Q1_CHIPS, DEFAULT_GREETING, chooseStarterChips, welcomeGreeting } from "./welcome.ts";
import { EVERYDAY_QUESTION_GROUPS } from "./suggestedQuestions.ts";

const pools = { persona: [{ id: "p1", text: "성향" }], everyday: [{ id: "e1", text: "일상" }] };

test("점성술에서 온 사용자: 환영 인사(닉네임이 있으면 이름 포함), 점성술 전용 말은 쓰지 않는다", () => {
  const g = welcomeGreeting({ fromAstro: true, nickname: "수진" });
  assert.match(g, /수진님/); assert.match(g, /반가워요/); assert.match(g, /쏠 아스트로 하우스/);
  assert.doesNotMatch(g, /(태양|달|상승|별자리|행성|사주|운세)/);
  assert.doesNotMatch(welcomeGreeting({ fromAstro: true, nickname: null }), /님,/);
});

test("점성술에서 오지 않았으면 기존 인사말 그대로", () => assert.equal(welcomeGreeting({ fromAstro: false, nickname: "수진" }), DEFAULT_GREETING));

test("시작 칩: Q1 답이 있으면 그 영역, 없으면 테스트 결과 여부에 따라", () => {
  const base = { hasPersona: false, fromAstro: true, nickname: null };
  assert.equal(chooseStarterChips({ ...base, astroQ1: "연애" }, pools).chips[0].id, "ed-love-1");
  assert.equal(chooseStarterChips({ ...base, astroQ1: "연애" }, pools).persona, false);
  assert.deepEqual(chooseStarterChips({ ...base, astroQ1: "알 수 없는 값" }, pools).chips, pools.everyday); // 모르는 값은 일상 문구
  assert.deepEqual(chooseStarterChips({ hasPersona: true, astroQ1: null, fromAstro: false, nickname: null }, pools), { chips: pools.persona, persona: true });
  assert.deepEqual(chooseStarterChips({ hasPersona: true, astroQ1: "가족", fromAstro: true, nickname: null }, pools).persona, false); // 점성술 영역이 우선, 일반 대화로 보냄
});

test("Q1 영역 6개가 모두 있고, 문구는 겹치지 않으며 진단·위기·폭력으로 읽힐 말이 없다", () => {
  assert.deepEqual(Object.keys(ASTRO_Q1_CHIPS).sort(), ["가족", "교우·사회관계", "연애", "재정·생활안정", "직업·커리어", "진로·자기계발"].sort());
  const bad = /(자살|자해|죽|우울|공황|폭력|때리|학대|약|진단|병원)/;
  const own = [ASTRO_Q1_CHIPS["연애"], ASTRO_Q1_CHIPS["가족"], ASTRO_Q1_CHIPS["재정·생활안정"]].flat();
  assert.equal(new Set(own.map((q) => q.id)).size, own.length);
  for (const q of own) assert.ok(!bad.test(q.text), q.text);
  assert.equal(ASTRO_Q1_CHIPS["직업·커리어"], EVERYDAY_QUESTION_GROUPS[0].questions);
});

test("점성술 버튼으로 들어와 맞춤 첫 인사가 있으면 그 문장을, 없으면 기존 환영 인사", () => {
  const custom = "지우님, 여기까지 와 줘서 고마워요. 올해를 '고생'이라고 고른 마음이 오래 남았어요.";
  assert.equal(welcomeGreeting({ fromAstro: true, nickname: "지우", astroGreeting: custom }), custom);
  assert.match(welcomeGreeting({ fromAstro: true, nickname: "지우", astroGreeting: null }), /쏠 아스트로 하우스에서 오셨군요/);
  assert.equal(welcomeGreeting({ fromAstro: false, nickname: null }), DEFAULT_GREETING);
});
