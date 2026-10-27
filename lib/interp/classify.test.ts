import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as K from "./vendor/claimClassifier.mjs";
import { buildClaims, buildScenes } from "./claims.ts";
import { buildClaimIndex } from "./search.ts";
import { classifyUtterance } from "./classify.ts";

const fx = JSON.parse(fs.readFileSync(new URL("./__fixtures__/claims_fixture.json", import.meta.url), "utf8"));
const claims = buildClaims(fx.claims, fx.claimRoots, fx.options, fx.roots);
K.setData({ claims, scenes: buildScenes(fx.scenes) });

// 가짜 임베딩: "낮게 볼까 봐/못한다" 계열이면 한 방향, "에너지/사람" 계열이면 다른 방향
const fake = async (texts: string[]) => texts.map((t) => [/낮게|못한|드러날|시선/.test(t) ? 1 : 0.01, /에너지|사람 만나|녹초/.test(t) ? 1 : 0.01, 0.01]);
const index = await buildClaimIndex(claims, fake);
const ctx = { messageId: "m1", chatId: "c1" };
const model = (obj: unknown) => async () => JSON.stringify(obj);
const run = (text: string, out: unknown, c = ctx) => classifyUtterance(text, c, { embed: fake, index, callModel: model(out) });
const claimOut = (claim_id: string, confidence: number, extra: object = {}) => ({ claims: [{ claim_id, evidence: "근거 문장", actor: "self", temporal: "now", negated: false, hypothetical: false, confidence, ...extra }], none: false });

test("위기 신호가 이미 걸렸으면(ctx.safetyHit) 모델을 부르지 않는다", async () => {
  let called = false;
  const r = await classifyUtterance("뭐든", { safetyHit: true }, { embed: fake, index, callModel: async () => { called = true; return "{}"; } });
  assert.equal(r.skipped, "safety");
  assert.equal(called, false);
  assert.deepEqual(r.events, []);
});

test("확신도 0.7 이상이면 뿌리마다 점수 사건(1.0)이 만들어지고, 사건 id는 메시지:claim:뿌리", async () => {
  const r = await run("못하는 게 드러날까 봐 운동이 싫어요", claimOut("C48-SEEN-LESS", 0.9));
  const ev = r.events.filter((e) => e.op === "apply");
  assert.ok(ev.length >= 1);
  assert.equal(ev[0].points, 1.0);
  assert.equal(ev[0].event_id, `m1:C48-SEEN-LESS:${ev[0].root_id}`);
  assert.equal(ev[0].source_type, "chat");
  assert.equal(ev[0].evidence, "근거 문장"); // 대표 결정: 원문 조각을 장부에 저장
});

test("0.5~0.7은 점수 없는 후보(op candidate)로만 돌려준다", async () => {
  const r = await run("못하는 게 드러날까 봐요", claimOut("C48-SEEN-LESS", 0.6));
  assert.ok(r.events.length >= 1 && r.events.every((e) => e.op === "candidate" && e.points === 0));
});

test("0.5 미만은 버린다", async () => {
  const r = await run("못하는 게 드러날까 봐요", claimOut("C48-SEEN-LESS", 0.4));
  assert.deepEqual(r.events, []);
});

test("뿌리 대표 claim은 0.5점", async () => {
  const r = await run("요즘 일이 너무 많아 지쳐요", claimOut("R-ROOT-10", 0.85));
  const ev = r.events.filter((e) => e.op === "apply");
  assert.ok(ev.length >= 1 && ev.every((e) => e.points === 0.5));
});

test("남 이야기·부정·가정·과거만인 말은 점수를 만들지 않는다", async () => {
  for (const extra of [{ actor: "other" }, { negated: true }, { hypothetical: true }, { temporal: "past" }]) {
    const r = await run("못하는 게 드러날까 봐요", claimOut("C48-SEEN-LESS", 0.9, extra));
    assert.deepEqual(r.events, [], JSON.stringify(extra));
  }
});

test("후보에 없는 id나 지어낸 id는 버린다", async () => {
  const r = await run("못하는 게 드러날까 봐요", claimOut("C-MADE-UP", 0.95));
  assert.deepEqual(r.events, []);
});

test("모델이 위기 의심(safety_suspect)이라고 하면 claim을 버린다(두 번째 그물)", async () => {
  const r = await run("못하는 게 드러날까 봐요", { claims: claimOut("C48-SEEN-LESS", 0.95).claims, safety_suspect: true, none: false });
  assert.equal(r.safety_suspect, true);
  assert.deepEqual(r.events, []);
});

test("JSON이 아닌 출력은 안전하게 빈 결과", async () => {
  const r = await classifyUtterance("뭐든 말이에요 길게", ctx, { embed: fake, index, callModel: async () => "죄송하지만 분류할 수 없어요" });
  assert.deepEqual(r.events, []);
});

test("임베딩 점수가 후보 순서를 정한다(검색 교체 확인)", async () => {
  let seen = "";
  await classifyUtterance("사람 만나면 에너지가 다 빠져요", ctx, { embed: fake, index, callModel: async ({ user }) => { seen = user; return "{}"; } });
  const b = seen.split("B. 세부 의미 후보")[1] ?? "";
  const iEnergy = b.indexOf("C-CO-DRN-1-ENERGY"), iSeen = b.indexOf("C48-SEEN-LESS");
  assert.ok(iEnergy > -1 && (iSeen === -1 || iEnergy < iSeen), "에너지 claim이 앞에 와야 함");
});

test("🔸 claim은 본인이 그 주제를 먼저 말했을 때만 후보에 들어간다", async () => {
  const sensitive = claims.find((c) => c.show_if)!.claim_id;
  let without = "", withTopic = "", saidNow = "";
  // 엔진 v1.8(분류기 v0.9): 이번 말에서 본인이 꺼낸 주제는 따로 알려 주지 않아도 읽는다(saidTopics). 그래서 주제 말이 없는 문장이 "아니요" 쪽 확인 문장이다.
  await classifyUtterance("요즘 마음이 좀 무거워요", ctx, { embed: fake, index, callModel: async ({ user }) => { without = user; return "{}"; } });
  await classifyUtterance("요즘 마음이 좀 무거워요", { ...ctx, mentioned: ["job_change"] } as never, { embed: fake, index, callModel: async ({ user }) => { withTopic = user; return "{}"; } });
  await classifyUtterance("퇴사 이직 걱정 일자리", ctx, { embed: fake, index, callModel: async ({ user }) => { saidNow = user; return "{}"; } });
  assert.ok(saidNow.split("B. 세부 의미 후보")[1].includes(sensitive)); // 이번 말에서 직접 꺼낸 주제는 넘겨 주지 않아도 후보에 오른다(v0.9)
  assert.ok(!without.split("B. 세부 의미 후보")[1].includes(sensitive));
  assert.ok(withTopic.split("B. 세부 의미 후보")[1].includes(sensitive));
});
