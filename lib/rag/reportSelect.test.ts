import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { selectReportSections, splitReportInsight } from "./reportSelect.ts";

// 실제 리포트와 같은 형식: 한 섹션이 한 줄, "[번호. 제목] 본문".
const REPORT = [
  "[1. 당신의 웰니스 프로파일] 당신은 계획을 세워 통제감을 만들어내는 유형이에요. 불확실한 상황에서 힘이 나는 편이에요.",
  "[2. 주목할 만한 부분은] 가장 안쪽으로 들어온 꼭짓점은 나 자신이에요. 요즘 에너지가 가장 필요한 영역이에요.",
  "[3. 고민을 다루는 나의 방식] 고민이 생기면 혼자 정리해보며 상황을 통제하려는 경향이 있어요.",
  "[4. 한 겹 더 들여다보기] 직장에서 상사와의 관계가 마음에 오래 남는 편이에요. 회사 일과 평가가 신경 쓰여요.",
  "[5. 이런 순간, 익숙하지 않나요?] 밤에 누우면 오늘 있었던 일이 계속 떠올라 잠들기 어려운 순간이 있어요.",
  "[6. 다른 유형과의 궁합] 연애에서는 서로 속도가 다른 유형과 잘 맞춰가는 것이 중요해요. 궁합이 좋은 유형이 있어요.",
  "[7. 앞으로 나아갈 방향] 작은 목표를 정하고 한 걸음씩 나아가는 방향이 잘 맞아요.",
  "[8. 이번 주 제안] 이번 주에는 결과와 상관없이 해볼 수 있는 작은 일 하나를 정해보세요.",
].join("\n");

describe("splitReportInsight", () => {
  test("한 줄에 한 섹션인 형식을 제목/본문으로 나눈다", () => {
    const s = splitReportInsight(REPORT);
    assert.equal(s.length, 8);
    assert.equal(s[1].label, "2. 주목할 만한 부분은");
    assert.match(s[7].body, /작은 일 하나/);
  });

  test("비었거나 형식이 다르면 빈 배열(호출하는 쪽이 전체를 그대로 쓰도록)", () => {
    assert.deepEqual(splitReportInsight(null), []);
    assert.deepEqual(splitReportInsight(""), []);
    assert.deepEqual(splitReportInsight("그냥 줄글 한 덩어리"), []);
  });
});

describe("selectReportSections — 기본 섹션 + 관련 섹션", () => {
  const secs = splitReportInsight(REPORT);
  const nums = (r: { selected: { label: string }[] }) => r.selected.map((s) => s.label.split(".")[0]);

  test("관련 없는 말(짧은 맞장구)이면 기본 섹션(2·8)만 들어간다", () => {
    assert.deepEqual(nums(selectReportSections(secs, { message: "네 고마워요" })), ["2", "8"]);
    assert.deepEqual(nums(selectReportSections(secs, { message: "힘들어요" })), ["2", "8"]);
  });

  test("주제어가 겹치면 그 섹션이 기본 섹션에 더해진다(직장/연애·궁합/잠)", () => {
    assert.deepEqual(nums(selectReportSections(secs, { message: "직장 상사 때문에 회사 가기가 싫어요" })), ["2", "4", "8"]);
    assert.deepEqual(nums(selectReportSections(secs, { message: "연애 궁합이 잘 맞는 유형이 궁금해요" })), ["2", "6", "8"]);
    assert.deepEqual(nums(selectReportSections(secs, { message: "밤에 누우면 잠들기가 어려워요" })), ["2", "5", "8"]);
  });

  test("관련 섹션은 최대 1개만 더한다(기본 2 + 1 = 3개)", () => {
    const r = selectReportSections(secs, { message: "직장 상사와 연애 궁합 때문에 밤에 잠들기 어려워요" });
    assert.equal(r.selected.length, 3);
  });

  test("직전 사용자 말도 약하게 반영한다(주제가 이어지는 후속 질문)", () => {
    const r = selectReportSections(secs, { message: "그래서 어떻게 하죠", recentUserMessages: ["직장 상사와 회사 일 때문에 힘들어요"] });
    assert.deepEqual(nums(r), ["2", "4", "8"]);
  });

  test("유형을 직접 물은 경우(characterization)는 프로파일·대처 방식(1, 3)도 같이 들어간다", () => {
    assert.deepEqual(nums(selectReportSections(secs, { message: "네" }, "characterization")), ["1", "2", "3", "8"]);
  });

  test("본문은 원래 섹션 순서대로 나오고, 제목 목록은 항상 전체가 나온다", () => {
    const r = selectReportSections(secs, { message: "연애 궁합이 궁금해요" });
    assert.deepEqual(nums(r), ["2", "6", "8"]);
    assert.equal(r.labels.length, 8);
  });

  test("번호 체계가 달라 기본 섹션이 하나도 안 맞으면 앞쪽 두 섹션으로 대신한다", () => {
    const odd = splitReportInsight("[가] 하나입니다.\n[나] 둘입니다.\n[다] 셋입니다.\n[라] 넷입니다.");
    const r = selectReportSections(odd, { message: "네" });
    assert.deepEqual(r.selected.map((s) => s.label), ["가", "나"]);
  });
});
