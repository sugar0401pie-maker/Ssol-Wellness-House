// 스크리닝 판단 로직 테스트(네트워크 없음). 설계: docs/안전설계_스크리닝흐름_v0.3.md
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  canSoftenCrisis, classifyScreenAnswer, countAbuseCueMessages, decideScreening, hasAbuseCue, hasDeathTalk, isWatchMarker, makeScreenMarker, outcomeFor, parseScreenMarker,
  type ScreenInput, type ScreenMarker,
} from "./screening.ts";
import { SCREEN_OK, SCREEN_QUESTION, SCREEN_RISK, SCREEN_STOP_REPEAT, SCREEN_UNCLEAR } from "./screeningTexts.ts";

const base: ScreenInput = { message: "", recentUserMessages: [], markers: [], pending: null, routeIsFixed: false };
const M = (kind: ScreenMarker["kind"], stage: ScreenMarker["stage"]): ScreenMarker => ({ kind, stage });

describe("표시(마커)", () => {
  test("만들고 다시 읽는다 · 형식이 다르면 무시", () => {
    assert.equal(makeScreenMarker("suicide", "asked"), "sw-scr:suicide:asked");
    assert.deepEqual(parseScreenMarker("sw-scr:violence:stop"), M("violence", "stop"));
    for (const bad of [null, undefined, "", "sw-root:ROOT-1:3", "sw-scr:x:asked", "sw-scr:suicide:done"]) assert.equal(parseScreenMarker(bad as string), null);
  });
  test("watch 기준: 위험 확인·애매·죽음 이야기에 아니요", () => {
    assert.equal(isWatchMarker(M("suicide", "stop")), true);
    assert.equal(isWatchMarker(M("violence", "unclear")), true);
    assert.equal(isWatchMarker(M("suicide", "ok")), true);
    assert.equal(isWatchMarker(M("violence", "ok")), false);
    assert.equal(isWatchMarker(M("suicide", "asked")), false);
  });
});

describe("S1 단서(죽음을 직접 말함)", () => {
  test("걸려야 하는 말", () => {
    for (const t of ["가족에게 유서 남기는 활동을 해보고 싶어요", "제 장례식을 상상해보라는 글을 봤어요", "내 죽음에 대해 써보려고요", "삶을 끊는 생각을 해본 적이 있어요", "제가 죽으면 가족이 어떨까요"]) assert.equal(hasDeathTalk(t), true, t);
  });
  test("일상 말은 걸리지 않는다", () => {
    for (const t of ["어제 장례식장에 다녀왔어요", "유서 깊은 가게에서 밥 먹었어요", "회사에서 죽을 것 같이 바빠요", "친구 할머니 장례식에 조문 갔어요"]) assert.equal(hasDeathTalk(t), false, t);
  });
});

describe("S2 단서(정서적 학대·통제)", () => {
  test("걸려야 하는 말(가스라이팅·V3~V6·약한 신체 위협)", () => {
    for (const t of ["남편이 가스라이팅을 하는 것 같아요", "카톡을 매일 다 보여 달래요", "헤어졌는데 회사 앞에서 계속 기다려요", "월급을 남편이 다 가져가요", "여친이 화낼까 봐 무서워서 늘 눈치 봐요", "화나면 물건을 던져요"]) assert.equal(hasAbuseCue(t), true, t);
  });
  test("일상 말은 걸리지 않는다", () => {
    for (const t of ["엄마가 잔소리가 심해서 짜증 나요", "남친이 연락을 자주 해서 좋아요", "팀장님 눈치를 많이 보는 편이에요", "엄마가 제 일정을 너무 조종하려고 해요", "친구랑 말다툼해서 서먹해요"]) assert.equal(hasAbuseCue(t), false, t);
  });
  test("단서가 나온 메시지 수를 센다(이번 포함)", () => {
    assert.equal(countAbuseCueMessages("카톡을 다 보여 달래요", ["오늘 날씨 좋네요"]), 1);
    assert.equal(countAbuseCueMessages("카톡을 다 보여 달래요", ["월급을 남편이 다 가져가요"]), 2);
  });
});

describe("답 분류(규칙)", () => {
  test("예·아니요·애매", () => {
    const cases: [string, string][] = [
      ["네", "yes"], ["있어요", "yes"], ["네 가끔 그런 생각을 해요", "yes"], ["지금도 무서워요", "yes"], ["응 그래요", "yes"],
      ["없어요", "no"], ["아니요", "no"], ["아뇨 괜찮아요", "no"], ["네, 없어요", "no"], ["한 적 없어요", "no"], ["전혀요", "no"],
      ["글쎄요", "unclear"], ["모르겠어요", "unclear"], ["", "unclear"], ["없는 건 아닌데요", "unclear"], ["있었는데 지금은 없어요", "unclear"],
      ["오늘 점심 뭐 먹을까요", "unclear"],
    ];
    for (const [t, want] of cases) assert.equal(classifyScreenAnswer(t), want, t);
  });
  test("긴 답은 규칙으로 정하지 않는다(애매 → 안전한 쪽)", () => {
    assert.equal(classifyScreenAnswer("아니요 그런데 사실은 어제 회사에서 있었던 일 때문에 더 힘들어서 그냥 다 그만두고 싶은 마음이긴 해요"), "unclear");
  });
  test("결과 → 표시·문구", () => {
    assert.deepEqual(outcomeFor("yes"), { stage: "stop", text: "risk" });
    assert.deepEqual(outcomeFor("no"), { stage: "ok", text: "ok" });
    assert.deepEqual(outcomeFor("unclear"), { stage: "unclear", text: "unclear" });
  });
});

describe("흐름 판단", () => {
  test("라우터가 위기·폭력으로 판정했으면 스크리닝은 끼어들지 않는다", () => {
    assert.deepEqual(decideScreening({ ...base, message: "유서를 써볼까요", routeIsFixed: true }), { type: "none" });
    assert.deepEqual(decideScreening({ ...base, message: "죽고 싶어요", pending: M("suicide", "asked"), routeIsFixed: true }), { type: "none" });
    assert.deepEqual(decideScreening({ ...base, message: "글쎄요", pending: M("suicide", "asked"), routeIsFixed: true }), { type: "none" }); // 더 조심스러운 라우터 응답을 따른다
    assert.deepEqual(decideScreening({ ...base, message: "네", pending: M("suicide", "asked"), routeIsFixed: true }), { type: "answer", kind: "suicide", result: "yes" }); // 같은 고정 응답 + 중단 표시
  });
  test("S1: 죽음 이야기가 나오면 질문하고, 한 대화에서 한 번만 한다", () => {
    assert.deepEqual(decideScreening({ ...base, message: "가족에게 유서 남기는 활동 해보고 싶어요" }), { type: "ask", kind: "suicide" });
    assert.deepEqual(decideScreening({ ...base, message: "유서 이야기를 다시 할게요", markers: [M("suicide", "ok")] }), { type: "none" });
  });
  test("질문 직후의 답을 분류한다", () => {
    assert.deepEqual(decideScreening({ ...base, message: "없어요", pending: M("suicide", "asked"), markers: [M("suicide", "asked")] }), { type: "answer", kind: "suicide", result: "no" });
    assert.deepEqual(decideScreening({ ...base, message: "있어요", pending: M("violence", "asked"), markers: [M("violence", "asked")] }), { type: "answer", kind: "violence", result: "yes" });
  });
  test("질문 뒤 다른 답변이 끼었으면(pending 아님) 답으로 보지 않는다", () => {
    assert.deepEqual(decideScreening({ ...base, message: "네", pending: null, markers: [M("suicide", "asked")] }), { type: "none" });
  });
  test("위험 확인(stop) 뒤에는 같은 대화의 모든 메시지에 중단 안내(새 대화 전까지)", () => {
    assert.deepEqual(decideScreening({ ...base, message: "오늘 날씨 좋네요", markers: [M("suicide", "asked"), M("suicide", "stop")], pending: M("suicide", "stop") }), { type: "stop_repeat", kind: "suicide" });
  });
  test("S2: 단서 첫 번째는 평소 대화, 두 번째부터 질문(같은 대화 안)", () => {
    assert.deepEqual(decideScreening({ ...base, message: "카톡을 다 보여 달래요" }), { type: "none" });
    assert.deepEqual(decideScreening({ ...base, message: "카톡을 다 보여 달래요", recentUserMessages: ["월급을 남편이 다 가져가요"] }), { type: "ask", kind: "violence" });
    assert.deepEqual(decideScreening({ ...base, message: "오늘은 날씨가 좋아요", recentUserMessages: ["월급을 남편이 다 가져가요", "카톡을 다 보여 달래요"] }), { type: "none" }); // 이번 메시지에 단서가 없으면 묻지 않는다
    assert.deepEqual(decideScreening({ ...base, message: "또 카톡을 다 보여 달래요", recentUserMessages: ["월급을 남편이 다 가져가요"], markers: [M("violence", "ok")] }), { type: "none" }); // 한 번만
  });
  test("S1이 S2보다 먼저", () => {
    assert.deepEqual(decideScreening({ ...base, message: "유서를 쓰고 싶고 카톡도 다 보여 달래요", recentUserMessages: ["월급을 남편이 다 가져가요"] }), { type: "ask", kind: "suicide" });
  });
});

describe("고정 문구 원칙", () => {
  test("모든 문구에 '~할 수 없어요'류 거절 표현이 없다", () => {
    const all = [...Object.values(SCREEN_QUESTION), ...Object.values(SCREEN_OK), ...Object.values(SCREEN_UNCLEAR), ...Object.values(SCREEN_STOP_REPEAT)];
    for (const t of all) assert.doesNotMatch(t, /(할|드릴|해드릴)\s*수\s*없|하지\s*않아요/, t);
  });
  test("질문은 한 번에 하나(물음표 하나)", () => {
    for (const t of Object.values(SCREEN_QUESTION)) assert.equal((t.match(/\?/g) ?? []).length, 1, t);
  });
  test("위험 확인 시 승인된 위기·폭력 고정 응답을 쓰고, 폭력에는 용도 재명시가 붙는다", () => {
    assert.match(SCREEN_RISK.suicide, /109/);
    assert.match(SCREEN_RISK.violence, /1366/);
    assert.match(SCREEN_RISK.violence, /대신하지 않아요/);
  });
});

describe("위기 → 질문 먼저(엄격한 조건)", () => {
  const cls = { route: "crisis", source: "classifier", classifierUnavailable: false };
  test("분류기만 위기로 본 죽음 이미지 활동 요청만 질문으로 바꾼다", () => {
    for (const t of ["가족에게 유서 남기는 활동을 해보고 싶어요", "제 장례식을 상상해보는 활동을 해보고 싶어요", "내 죽음에 대해 글로 써보려고 해요", "죽음을 상상하는 명상을 해보려고요"]) assert.equal(canSoftenCrisis(cls, t), true, t);
  });
  test("자해·자살 의사 표현이 있으면 바꾸지 않는다", () => {
    for (const t of ["제 장례식을 상상해보는 활동을 하고 싶은데 사실 죽고 싶어서요", "유서를 써보려고요 자살할 거예요", "삶을 끊는 생각을 해본 적이 있어요", "내 죽음을 상상해보는데 살 이유가 없어요"]) assert.equal(canSoftenCrisis(cls, t), false, t);
  });
  test("키워드가 걸렸거나 분류기 장애·다른 경로면 바꾸지 않는다", () => {
    const t = "가족에게 유서 남기는 활동을 해보고 싶어요";
    assert.equal(canSoftenCrisis({ ...cls, source: "keyword+classifier" }, t), false);
    assert.equal(canSoftenCrisis({ ...cls, source: "keyword" }, t), false);
    assert.equal(canSoftenCrisis({ ...cls, classifierUnavailable: true }, t), false);
    assert.equal(canSoftenCrisis({ ...cls, route: "violence" }, t), false);
  });
});
