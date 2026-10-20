import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInsights, isInsightAction, isRootId, INSIGHT_MAX_ITEMS } from "./insights.ts";
import type { RootText, StateLite } from "./speak.ts";

const T = (id: string, over: Partial<RootText> = {}): RootText => ({ root_id: id, name: id, reflect: [], check_q: ["q"], counter: [], strength: "강점", report: `${id} 문장`, sensitive: false, ...over });
const S = (root_id: string, score: number, status = "candidate", sources: string[] = ["chat"]): StateLite => ({ root_id, score, status, sources });

test("확인된 것 → 가능성 높은 것 → 점수 순으로, 거절·민감·문장 없음·낮은 점수는 뺀다", () => {
  const texts = Object.fromEntries([T("A"), T("B"), T("C"), T("D", { sensitive: true }), T("E", { report: "" }), T("F"), T("G")].map((t) => [t.root_id, t]));
  const r = buildInsights([S("A", 2, "likely"), S("B", 1, "candidate"), S("C", 0.3, "confirmed"), S("D", 5, "confirmed"), S("E", 5), S("F", 5, "rejected"), S("G", 0.5)], texts);
  assert.deepEqual(r.map((x) => x.rootId), ["C", "A", "B"]);
  assert.equal(r[0].status, "confirmed");
  assert.equal(r[1].status, "guess");
});

test("점수가 낮아도 사용자가 맞다고 한 것은 보여 준다 · 문장 정보가 없는 뿌리는 뺀다", () => {
  assert.deepEqual(buildInsights([S("X", 0, "confirmed")], { X: T("X") }).map((x) => x.rootId), ["X"]);
  assert.deepEqual(buildInsights([S("Y", 3)], {}), []);
});

test("최대 개수를 넘기지 않는다", () => {
  const ids = Array.from({ length: 10 }, (_, i) => `R${i}`);
  const r = buildInsights(ids.map((i) => S(i, 2)), Object.fromEntries(ids.map((i) => [i, T(i)])));
  assert.equal(r.length, INSIGHT_MAX_ITEMS);
});

test("요청 값 검사", () => {
  assert.ok(isInsightAction("remove") && !isInsightAction("delete") && !isInsightAction(undefined));
  assert.ok(isRootId("ROOT-48") && isRootId("ROOT-S09") && !isRootId("ROOT-48; drop") && !isRootId(5) && !isRootId("root-1"));
});

test("출처 표시: 대화 근거가 있으면 chat, 테스트 근거만이면 test", () => {
  const r = buildInsights([S("A", 2, "candidate", ["test"]), S("B", 2, "candidate", ["test", "chat"])], { A: T("A"), B: T("B") });
  assert.deepEqual(r.map((x) => [x.rootId, x.from]).sort(), [["A", "test"], ["B", "chat"]]);
});
