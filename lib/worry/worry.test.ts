import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTextIndex, scoreAgainst } from "./textIndex.ts";
import { isHeavyText, worryGuidanceBlock, worryRecord, type WorryRoute, type WorrySignals } from "./guidance.ts";
import * as WM from "../interp/vendor/worryMatch.mjs";
import { worryDataFromDb } from "../interp/vendor/dbLoader.mjs";

// 가짜 임베딩: 글자마다 정해진 축 — 같은 글자가 많을수록 가깝다.
const fakeEmbed = async (texts: string[]) => texts.map((t) => { const v = new Array(8).fill(0); for (const ch of t) v[ch.charCodeAt(0) % 8] += 1; return v; });

test("색인: 문장마다 벡터 하나, 빈 문장은 뺀다, 나눠 보내도 순서 유지", async () => {
  let calls = 0;
  const idx = await buildTextIndex([{ id: "a", text: "가가가" }, { id: "b", text: " " }, { id: "c", text: "나나" }], async (t) => { calls++; return fakeEmbed(t); }, 1);
  assert.deepEqual(idx.ids, ["a", "c"]);
  assert.equal(calls, 2);
});

test("색인: 개수가 다르면 실패(조용히 어긋나지 않게)", async () => {
  await assert.rejects(buildTextIndex([{ id: "a", text: "가" }], async () => []));
});

test("점수: 가까운 문장이 더 높고, 차원이 다르면 빈 결과(글자 비교로 돌아가게)", async () => {
  const idx = await buildTextIndex([{ id: "a", text: "aaa" }, { id: "c", text: "bb" }], fakeEmbed);
  const [q] = await fakeEmbed(["aa"]);
  const s = scoreAgainst(q, idx);
  assert.ok(s.a > s.c);
  assert.ok(Math.abs(s.a - 1) < 1e-6);
  assert.deepEqual(scoreAgainst([1, 2, 3], idx), {});
});

const sig = (kinds: string[], level: "strong" | "normal" = "strong"): WorrySignals => ({ form: null, areas: [], intensity: { level, signals: [], kinds, word: null, ack: null } });

test("힘든 메시지: 감정 갈래(feeling)만 센다 — 길이·반복만으로는 세지 않음, 못 읽으면 안 셈", () => {
  assert.equal(isHeavyText(sig(["feeling", "length"])), true);
  assert.equal(isHeavyText(sig(["length", "repeat"])), false);
  assert.equal(isHeavyText(null), false);
});

const baseRoute: WorryRoute = {
  intent_id: "WK-QUIT", name: "퇴사할지", topic: "이직·퇴사", scene_key: "job_change", scene_candidate: null, mode: "cards",
  questions: ["가장 지치게 하는 건 뭐예요?", "그만두면 제일 먼저 하고 싶은 건요?", "세 번째 질문"], tone: "acknowledge_first", ack: "많이 지쳐 있는 마음이 느껴져요.",
  thought: { surface: "퇴사할지", first: "쉬고 싶은 마음", second: "다음이 불안한 마음", line: "퇴사할지보다 쉬고 싶은 마음이 더 크게 남아 있을 수 있어요. 다음이 불안한 마음도 함께요." },
  first_card: "CC-JCH-1", preferOptions: ["CO-JCH-1-TIRED"], secondary: null,
};

test("첫 답변 지침: 받아 주는 한 줄 → 기저 생각 → 질문(최대 2개) 순서, 단정 금지 문구 포함", () => {
  const b = worryGuidanceBlock(baseRoute, { secondaryLine: null })!;
  assert.ok(b.indexOf("많이 지쳐") < b.indexOf("쉬고 싶은 마음"));
  assert.match(b, /단정하지 않는다/);
  assert.match(b, /확정하지 않는다/);
  assert.doesNotMatch(b, /세 번째 질문/);
  assert.equal(worryGuidanceBlock(null), null);
});

test("첫 답변 지침: 바로 뒤에 카드가 붙으면 마지막 질문 재료를 넣지 않는다(두 번 묻지 않게)", () => {
  const withQ = worryGuidanceBlock(baseRoute)!;
  const noQ = worryGuidanceBlock(baseRoute, { cardFollows: true })!;
  assert.match(withQ, /가장 지치게 하는 건/);
  assert.doesNotMatch(noQ, /가장 지치게 하는 건|한 번만 묻는다/);
  assert.match(noQ, /쉬고 싶은 마음/); // 기저 생각 한 줄은 그대로
});

test("첫 답변 지침: 강도가 보통이면 받아 주는 한 줄을 넣지 않는다, 부 고민 한 줄은 있을 때만", () => {
  const b = worryGuidanceBlock({ ...baseRoute, tone: null, ack: null }, { secondaryLine: "겉으로는 퇴사할지를 묻고 있지만, 연애도 함께 걸려 있는 것 같아요." })!;
  assert.doesNotMatch(b, /맨 앞에서 힘듦/);
  assert.match(b, /함께 걸려/);
});

test("기록: 원문 없이 고른 결과·신호 id만", () => {
  const r = worryRecord({ route: baseRoute, sig: { ...sig(["feeling"]), intensity: { ...sig(["feeling"]).intensity, signals: ["IC-F02"] } }, pickedBy: "model", candidates: [{ intent_id: "WK-QUIT", score: 0.61234 }], reason: null, at: "t" });
  assert.equal(r.intent_id, "WK-QUIT");
  assert.deepEqual(r.signals, ["IC-F02"]);
  assert.deepEqual(r.candidates, [{ intent_id: "WK-QUIT", score: 0.612 }]);
  assert.ok(!JSON.stringify(r).includes("지쳐"));
});

test("엔진 연결: DB 행 → worryDataFromDb → 임베딩 점수로 후보 → routeFor가 장면·첫 카드 보기·받아 주는 한 줄을 준다", () => {
  const d = worryDataFromDb({
    sw_ob_worry_intents: [
      { intent_id: "WK-QUIT", name: "퇴사할지", topic: "이직·퇴사", scene_key: "job_change", scene_status: "기존 장면", definition: "d", cues: "c", neighbor_diff: "n" },
      { intent_id: "LF-MOVE", name: "이사할지", topic: "생활", scene_key: "move", scene_status: "새 장면 후보", definition: "d", cues: "c", neighbor_diff: "n" },
    ],
    sw_ob_worry_utterances: [{ utt_id: "U1", intent_id: "WK-QUIT", text: "회사 그만둘까요" }, { utt_id: "U2", intent_id: "LF-MOVE", text: "이사 갈까요" }],
    sw_ob_worry_confusers: [], sw_ob_worry_questions: [{ intent_id: "WK-QUIT", question: "무엇이 가장 지치게 해요?" }], sw_ob_worry_pairs: [], sw_ob_worry_rules: [],
    sw_ob_worry_intensity_cues: [{ cue_id: "IC-F02", kind: "feeling", pattern: "지치|지쳐", word: "지친", line: "{word} 마음이 느껴져요.", priority: 1 }],
    sw_ob_worry_thoughts: [{ intent_id: "WK-QUIT", surface: "퇴사할지", first: "쉬고 싶은 마음", second: "다음이 불안한 마음", status: "검수 완료" }],
    sw_ob_worry_entry: [{ intent_id: "WK-QUIT", card_id: "CC-JCH-1", option_ids: "CO-JCH-1-TIRED,CO-JCH-1-NEXT" }],
  });
  WM.setWorryData(d);
  const text = "회사 다니기 너무 지쳐요";
  const s = WM.signalsOf(text) as WorrySignals;
  assert.equal(isHeavyText(s), true);
  const cands = WM.rankIntents(text, { scores: { U1: 0.7, U2: 0.2 }, confScores: { U1: 0.7, U2: 0.2 } }) as { intent_id: string }[];
  assert.equal(cands[0].intent_id, "WK-QUIT");
  const r = WM.routeFor("WK-QUIT", null, { intensity: s.intensity }) as WorryRoute;
  assert.equal(r.mode, "cards");
  assert.equal(r.scene_key, "job_change");
  assert.deepEqual(r.preferOptions, ["CO-JCH-1-TIRED", "CO-JCH-1-NEXT"]);
  assert.equal(r.tone, "acknowledge_first");
  assert.match(r.ack ?? "", /지친 마음/);
  assert.match(r.thought?.line ?? "", /쉬고 싶은 마음이 더 크게/);
  const m = WM.routeFor("LF-MOVE", null, {}) as WorryRoute;
  assert.equal(m.mode, "free_talk"); // 새 장면 후보는 카드가 아니라 자유 대화
  assert.equal(m.scene_candidate, "move");
  const b = worryGuidanceBlock(r)!;
  assert.match(b, /무엇이 가장 지치게/);
});
