import { test } from "node:test";
import assert from "node:assert/strict";
import { handoffChallenge, sowellaChallengeUrl } from "./challenge.ts";

const engine = {
  days: [
    { day: 1, text: "다이어리에 요즘 마음을 세 가지 적기" },
    { day: 2, text: "친구들과 함께 요리하는 모임 열기", why: "현침살과 장성살을 함께 쓰는 행동이에요." },
    { day: 3, text: "혼자 처음 가 보는 동네의 작은 전시 들르기", why: "역마살과 화개살을 함께 쓰는 행동이에요." },
  ],
  week: { text: "공방 원데이 클래스에서 소품 만들기", why: "역마살과 현침살을 함께 쓰는 행동이에요." },
  month: { text: "시장 한 바퀴 돌며 제철 먹거리 맛보기", when: "2월에", why: "현침살과 정록을 함께 쓰는 행동이에요." },
};

test("쏘웰라가 받는 다섯 칸 모양으로 바꾼다", () => {
  const h = handoffChallenge(engine)!;
  assert.deepEqual(Object.keys(h), ["day1", "day2", "day3", "week", "month"]);
  assert.deepEqual(h.day1, { title: "다이어리에 요즘 마음을 세 가지 적기", description: null });
  assert.equal(h.day2.description, "현침살과 장성살을 함께 쓰는 행동이에요.");
  assert.equal(h.week?.title, "1주일 이어 가기");
  assert.equal(h.week?.description, "공방 원데이 클래스에서 소품 만들기 — 역마살과 현침살을 함께 쓰는 행동이에요.");
  assert.equal(h.month?.title, "1달 이어 가기");
  assert.ok(h.month?.description?.startsWith("2월에 시장 한 바퀴"));
});

test("1·2·3일차 중 하나라도 비면 넘기지 않는다(쏘웰라도 받지 않음)", () => {
  assert.equal(handoffChallenge({ days: [engine.days[0], engine.days[1]] }), null);
  assert.equal(handoffChallenge(null), null);
});

test("1주일·1달이 없어도 3일 계획은 넘긴다", () => {
  const h = handoffChallenge({ days: engine.days })!;
  assert.equal(h.week, null);
  assert.equal(h.month, null);
});

test("제목 80자, 설명 300자를 넘지 않는다", () => {
  const long = "가".repeat(120);
  const h = handoffChallenge({ days: [{ day: 1, text: long, why: long.repeat(3) }, engine.days[1], engine.days[2]] })!;
  assert.equal([...h.day1.title].length, 80);
  assert.equal([...(h.day1.description ?? "")].length, 300);
});

test("쏘웰라 주소는 타로와 같은 모양", () => {
  assert.equal(
    sowellaChallengeUrl("3f2b7c1e-1111-4222-8333-944455556666", "https://app.ssolwellnesshouse.com/"),
    "https://app.ssolwellnesshouse.com/challenge?from=saju&result=3f2b7c1e-1111-4222-8333-944455556666",
  );
});
