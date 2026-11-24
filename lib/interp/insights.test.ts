import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInsights, groupInsights, interpretationParagraphs, isInsightAction, isRootId, latestTalkInsight, splitFirstSentence, INSIGHT_MAX_ITEMS } from "./insights.ts";
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

test("출처 표시: 대화 근거가 있으면 chat, 고른 답(테스트·온보딩)만이면 answers", () => {
  const r = buildInsights([S("A", 2, "candidate", ["test"]), S("B", 2, "candidate", ["test", "chat"])], { A: T("A"), B: T("B") });
  assert.deepEqual(r.map((x) => [x.rootId, x.from]).sort(), [["A", "answers"], ["B", "chat"]]);
});

test("대화 근거 없이 고른 답만으로는 점수 2.0 이상일 때만 보여 준다", () => {
  const texts = { A: T("A"), B: T("B"), C: T("C") };
  const r = buildInsights([S("A", 1.5, "candidate", ["onboarding"]), S("B", 2.0, "candidate", ["onboarding", "test"]), S("C", 1.0, "candidate", ["chat"])], texts);
  assert.deepEqual(r.map((x) => x.rootId).sort(), ["B", "C"]);
});

const L = (root_id: string, score: number, ledger: { source: string; at: string; points?: number; validity?: string }[], status = "likely") =>
  ({ root_id, score, status, sources: [...new Set(ledger.map((e) => e.source))], ledger: ledger.map((e) => ({ points: 1, validity: "active", ...e })) }) as unknown as StateLite;

test("가장 최근 대화 기준 한 개: 대화(채팅·과제)에서 마지막으로 비친 마음 · 지운 근거·답만 있는 마음은 아님", () => {
  const texts = Object.fromEntries(["A", "B", "C", "D"].map((i) => [i, T(i)]));
  const states = [
    L("A", 5, [{ source: "chat", at: "2026-11-20T10:00:00Z" }]),
    L("B", 1.5, [{ source: "chat", at: "2026-11-23T09:00:00Z" }, { source: "test", at: "2026-11-24T00:00:00Z" }]),
    L("C", 3, [{ source: "chat", at: "2026-11-24T05:00:00Z", validity: "superseded" }]), // 지운 근거
    L("D", 9, [{ source: "onboarding", at: "2026-11-24T06:00:00Z" }]), // 답만
  ];
  assert.equal(latestTalkInsight(states, texts)?.rootId, "B");
  assert.equal(latestTalkInsight([L("D", 9, [{ source: "onboarding", at: "2026-11-24T06:00:00Z" }])], texts), null);
});

test("해석 화면 묶음: 맞다고 하신 → 이야기 → 답, 빈 묶음은 뺀다 · 첫 문장 나누기", () => {
  const items = buildInsights([S("A", 0, "confirmed"), S("B", 2), S("C", 3, "candidate", ["test"])], { A: T("A"), B: T("B"), C: T("C") }, 10);
  assert.deepEqual(groupInsights(items).map((g) => [g.key, g.items.map((i) => i.rootId)]), [["confirmed", ["A"]], ["chat", ["B"]], ["answers", ["C"]]]);
  assert.deepEqual(groupInsights([]), []);
  assert.deepEqual(splitFirstSentence("첫 문장이에요. 둘째 문장이에요."), ["첫 문장이에요.", "둘째 문장이에요."]);
  assert.deepEqual(splitFirstSentence("한 문장뿐"), ["한 문장뿐", ""]);
});

test("읽은 것들 화면: 글머리 문단 — 첫 문단 '이런 마음이 보여요', 다음부터 '이런 모습도 있어요', 변화는 마지막", () => {
  const items = buildInsights([S("A", 0, "confirmed"), S("B", 2)], { A: T("A"), B: T("B", { strength: "" }) }, 10);
  const p = interpretationParagraphs(items, ["요즘 하고 싶은 쪽으로 움직이고 있어요."], "곽이");
  assert.deepEqual(p.map((x) => x.lead), ["곽이님은 이런 마음이 보여요.", "곽이님은 이런 모습도 있어요.", "곽이님에게 요즘 이런 변화도 보여요."]);
  assert.deepEqual(p[0].extras, ["강점"]);
  assert.deepEqual(p[1].extras, []); // 빈 강점은 뺀다
  assert.equal(p[2].text, null);
  assert.equal(interpretationParagraphs(items, [], null)[0].lead, "이런 마음이 보여요.");
});
