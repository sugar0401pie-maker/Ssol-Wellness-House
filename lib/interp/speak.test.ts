import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HYPOTHESIS_MAX_TURN, buildDiscGroups, buildRootTexts, chooseSpeak, classifyReplyRules, discPrompt, hypothesisBlock, inSpeakWindow,
  makeMarker, parseDiscChoice, parseMarker, parseReplyLabel, rankRoots, type DiscGroup, type StateLite,
} from "./speak.ts";

const S = (root_id: string, score: number, status = "candidate", sources: string[] = ["chat"]): StateLite => ({ root_id, score, status, sources });
const G: DiscGroup = { group_id: "DG-01", roots: ["ROOT-77", "ROOT-81"], ask: "상대 표정이 더 걸려요, 분위기가 더 걸려요?", options: [{ root: "ROOT-77", answer_hint: "상대가 서운해할 얼굴" }, { root: "ROOT-81", answer_hint: "분위기가 싸해질까 봐" }] };

test("가설을 말하는 구간은 쏘웰라의 2~4번째 답변(owner: 4턴까지)", () => {
  assert.equal(HYPOTHESIS_MAX_TURN, 4);
  assert.deepEqual([1, 2, 3, 4, 5, 8].map(inSpeakWindow), [false, true, true, true, false, false]);
});

test("후보: 점수 기준(1.0) 이상, 확인·거절된 뿌리와 이미 말한 뿌리는 제외, 높은 점수 순", () => {
  const r = rankRoots([S("A", 2), S("B", 0.5), S("C", 1.5, "likely"), S("D", 3, "confirmed"), S("E", 3, "rejected"), S("F", 1.0)], new Set(["F"]));
  assert.deepEqual(r.map((x) => x.root_id), ["A", "C"]);
});

test("점수가 같으면 출처가 많은 쪽, 그래도 같으면 뿌리 번호 순(항상 같은 결과)", () => {
  const r = rankRoots([S("ROOT-9", 2, "candidate", ["chat"]), S("ROOT-3", 2, "candidate", ["chat", "test"]), S("ROOT-1", 2, "candidate", ["chat"])], new Set());
  assert.deepEqual(r.map((x) => x.root_id), ["ROOT-3", "ROOT-1", "ROOT-9"]);
});

test("후보가 없으면 말하지 않는다", () => {
  assert.equal(chooseSpeak([S("A", 0.5)], new Set(), [], new Set()), null);
  assert.equal(chooseSpeak([], new Set(), [], new Set()), null);
});

test("1위가 뚜렷하면 가설을 말한다", () => {
  const c = chooseSpeak([S("ROOT-77", 3), S("ROOT-81", 1)], new Set(), [G], new Set());
  assert.deepEqual(c, { kind: "hypothesis", root: "ROOT-77", score: 3 });
});

test("1·2위가 1점 안이고 가르기 질문이 있으면 그 질문을 먼저 한다", () => {
  const c = chooseSpeak([S("ROOT-77", 1), S("ROOT-81", 1)], new Set(), [G], new Set());
  assert.equal(c?.kind, "discriminator");
  assert.equal(c && c.kind === "discriminator" && c.group.group_id, "DG-01");
});

test("가르기 질문이 없거나 이미 물었으면 1위 가설을 말한다", () => {
  assert.equal(chooseSpeak([S("ROOT-77", 1), S("ROOT-81", 1)], new Set(), [], new Set())?.kind, "hypothesis");
  assert.equal(chooseSpeak([S("ROOT-77", 1), S("ROOT-81", 1)], new Set(), [G], new Set(["DG-01"]))?.kind, "hypothesis");
});

test("반영 문장 + 확인 질문을 DB 원문 그대로 잇고, 턴에 따라 변형을 돌린다", () => {
  const t = { root_id: "R", name: "n", reflect: ["반영1", "반영2"], check_q: ["질문1", "질문2"], counter: [], strength: "", sensitive: false };
  assert.equal(hypothesisBlock(t, 2), "반영1 질문1");
  assert.equal(hypothesisBlock(t, 3), "반영2 질문2");
  assert.equal(hypothesisBlock({ ...t, reflect: [] }, 2), "질문1");
});

test("마커: 만들고 다시 읽는다 · 형식이 다르면 무시", () => {
  const m = makeMarker("hyp", "ROOT-48", 12);
  assert.equal(m, "sw-root:ROOT-48:12");
  assert.deepEqual(parseMarker(m), { kind: "hyp", id: "ROOT-48", logId: 12 });
  assert.deepEqual(parseMarker(makeMarker("disc", "DG-01", 5)), { kind: "disc", id: "DG-01", logId: 5 });
  for (const bad of [null, undefined, "", "ACT-S01", "sw-root:ROOT-48", "sw-root:ROOT-48:x"]) assert.equal(parseMarker(bad as string), null);
});

test("답 분류(규칙): 동의·거절·일부·모름", () => {
  const cases: [string, string | null][] = [
    ["네 맞아요", "agree"], ["맞아요!", "agree"], ["그런 것 같아요", "agree"], ["비슷해요", "agree"], ["응 그래요", "agree"], ["딱 그래요", "agree"],
    ["아니에요", "disagree"], ["그건 아닌데요", "disagree"], ["그렇지 않아요", "disagree"], ["아뇨", "disagree"], ["전혀요", "disagree"],
    ["조금은요", "partial"], ["일부는 그런 것 같아요", "partial"], ["가끔은 그래요", "partial"],
    ["잘 모르겠어요", "unsure"], ["글쎄요", "unsure"],
    ["오늘 점심 뭐 먹을까요", null],
  ];
  for (const [t, want] of cases) assert.equal(classifyReplyRules(t), want, t);
});

test("긴 답은 규칙으로 정하지 않고 모델에 맡긴다", () => {
  assert.equal(classifyReplyRules("네 맞아요 그런데 사실은 어제 회사에서 있었던 일 때문에 더 그런 것 같고 팀장님이 또 그렇게 말씀하셔서"), null);
});

test("모델 답 파싱: 정해진 값만 인정", () => {
  assert.equal(parseReplyLabel('{"answer":"partial"}'), "partial");
  assert.equal(parseReplyLabel('```json\n{"answer":"agree"}\n```'), "agree");
  assert.equal(parseReplyLabel('{"answer":"maybe"}'), null);
  assert.equal(parseReplyLabel("not json"), null);
});

test("가르기 질문 답: 한쪽·둘 다·모름을 인정하고 선택지에 없는 값은 버린다", () => {
  assert.deepEqual(parseDiscChoice('{"choice":"ROOT-81"}', G), { root: "ROOT-81" });
  assert.equal(parseDiscChoice('{"choice":"both"}', G), "both");
  assert.equal(parseDiscChoice('{"choice":"none"}', G), "none");
  assert.equal(parseDiscChoice('{"choice":"ROOT-99"}', G), null);
  assert.match(discPrompt(G, "분위기요").system, /ROOT-77\|ROOT-81\|both\|none/);
});

test("DB 행 → 데이터 변환: 빈 문장은 건너뛰고, 형식이 이상한 가르기 질문은 쓰지 않는다", () => {
  const texts = buildRootTexts([{ root_id: "ROOT-48", reflect_1: "a", reflect_2: "", check_q_1: "q", counter_1: "c" }], [{ root_id: "ROOT-48", name: "이름" }]);
  assert.deepEqual(texts["ROOT-48"].reflect, ["a"]);
  assert.deepEqual(texts["ROOT-48"].check_q, ["q"]);
  assert.equal(texts["ROOT-48"].name, "이름");
  assert.equal(texts["ROOT-48"].sensitive, false);
  assert.equal(buildRootTexts([{ root_id: "R", sensitive: true }], [])["R"].sensitive, true);
  const g = buildDiscGroups([
    { group_id: "DG-01", roots: "ROOT-77, ROOT-81", ask: "?", options_json: '[{"answer_hint":"x","root":"ROOT-77"},{"answer_hint":"y","root":"ROOT-81"}]' },
    { group_id: "DG-02", roots: "ROOT-1, ROOT-2", ask: "?", options_json: "깨진 값" },
  ]);
  assert.deepEqual(g.map((x) => x.group_id), ["DG-01"]);
  assert.deepEqual(g[0].roots, ["ROOT-77", "ROOT-81"]);
});
