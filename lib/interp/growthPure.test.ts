import test from "node:test";
import assert from "node:assert/strict";
import * as D from "./vendor/direction.mjs";
import * as M from "./vendor/motive.mjs";
import { freshRows, motiveDomains, suggestedByBot, withMessage, type SignalRow } from "./growthPure.ts";

const AXES = [{ axis: "regulate", slot: "growth.regulate", label: "멈추고 조절", report_first: "처음 줄", report_more: "전보다 조금 더 멈추고 조절하고 있어요" }];
(D.setDirectionData as (x: unknown) => unknown)({ claims: [{ claim_id: "DIR-REG-PAUSE", kind: "방향", direction: "regulate" }, { claim_id: "C-1", kind: "마음" }], axes: AXES, rootTexts: [{ root_id: "ROOT-04", strength: "강점 문장" }] });
(M.setMotiveData as (x: unknown) => unknown)({ claims: [{ claim_id: "C-9", motive: "introjected" }, { claim_id: "C-8", motive: "" }], sceneDomains: [{ scene_key: "group_exercise", domain: "exercise" }], positions: [] });

test("suggestedByBot: 쏘웰라 제안에 '네'만 한 짧은 대답", () => {
  assert.equal(suggestedByBot("이렇게 해볼까요?", "네"), true);
  assert.equal(suggestedByBot("이렇게 해볼까요?", "그럼요!"), true);
  assert.equal(suggestedByBot("이렇게 해볼까요?", "예전 같으면 화냈을 텐데 숨을 골랐어요"), false);
  assert.equal(suggestedByBot(null, "네"), false);
});

test("방향 신호: 남 이야기·가정은 세지 않고 같은 축은 한 번만", () => {
  const rows = D.directionSignals({ claims: [{ claim_id: "DIR-REG-PAUSE", confidence: 0.9 }, { claim_id: "DIR-REG-PAUSE", confidence: 0.8 }, { claim_id: "C-1", confidence: 0.9 }] }, { userId: "u", chatId: "c", messageId: "m1", at: "2026-10-28T00:00:00Z", rootsInMessage: ["ROOT-04"] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].slot, "growth.regulate");
  assert.deepEqual(rows[0].value.roots, ["ROOT-04"]);
  assert.equal(D.directionSignals({ claims: [{ claim_id: "DIR-REG-PAUSE", confidence: 0.9, actor: "other" }] }, { userId: "u" }).length, 0);
  assert.equal(D.directionSignals({ claims: [{ claim_id: "DIR-REG-PAUSE", confidence: 0.9 }] }, { userId: "u", suggestedByAi: true }).length, 0);
});

test("동기 위치 신호: 표시 없는 claim은 기록하지 않고, 행에는 사용자 말이 없다", () => {
  const rows = M.motiveSignals(["C-9", "C-8", "C-none"], { userId: "u", chatId: "c", at: "2026-10-28T00:00:00Z", scene: "group_exercise" }) as SignalRow[];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].slot, "motive.exercise");
  assert.deepEqual(Object.keys(rows[0].value!).sort(), ["claim_id", "position", "scene"]);
});

test("freshRows: 같은 메시지·claim은 다시 기록하지 않는다", () => {
  const base = D.directionSignals({ claims: [{ claim_id: "DIR-REG-PAUSE", confidence: 0.9 }] }, { userId: "u", chatId: "c", messageId: "m1", at: "2026-10-28T00:00:00Z" }) as SignalRow[];
  assert.equal(freshRows(base, []).length, 1);
  assert.equal(freshRows(base, [{ slot: "growth.regulate", value: base[0].value, observed_at: "x" }]).length, 0);
  assert.equal(freshRows([...base, ...base], []).length, 1);
});

test("withMessage: 동기 위치 행에 메시지 id를 붙이되 이미 있으면 유지", () => {
  const [r] = withMessage([{ user_id: "u", slot: "motive.work", value: { position: "external", claim_id: "C-9" }, observed_at: "t" }], "m9");
  assert.equal(r.value!.message_id, "m9");
  const [k] = withMessage([{ user_id: "u", slot: "growth.aware", value: { message_id: "m1" }, observed_at: "t" }], "m9");
  assert.equal(k.value!.message_id, "m1");
});

test("방향 요약: 늘었을 때만 문장, 줄었다는 말은 없다 · 처음이면 시작 문장", () => {
  const now = Date.parse("2026-10-28T00:00:00Z"), d = (n: number) => new Date(now - n * 864e5).toISOString();
  const first = D.directionSummary([{ slot: "growth.regulate", observed_at: d(3) }], { now });
  assert.equal(first[0].line, "처음 줄");
  const more = D.directionSummary([{ slot: "growth.regulate", observed_at: d(3) }, { slot: "growth.regulate", observed_at: d(5) }, { slot: "growth.regulate", observed_at: d(40) }], { now });
  assert.equal(more[0].line, "전보다 조금 더 멈추고 조절하고 있어요");
  const less = D.directionSummary([{ slot: "growth.regulate", observed_at: d(3) }, { slot: "growth.regulate", observed_at: d(40) }, { slot: "growth.regulate", observed_at: d(45) }], { now });
  assert.equal(less[0].line, null);
});

test("뿌리 방향 한 줄: 같은 메시지의 뿌리일 때만 '쓰는 쪽', 단순 유력은 '끌려다님'(내부 값)", () => {
  const now = Date.parse("2026-10-28T00:00:00Z");
  const sig = [{ slot: "growth.regulate", observed_at: new Date(now - 864e5).toISOString(), value: { roots: ["ROOT-04"] } }];
  assert.equal(D.useDirection("ROOT-04", null, sig, { now }), "using");
  assert.equal(D.useDirection("ROOT-10", null, sig, { now }), "unknown");
  assert.equal(D.rootDirectionLine("ROOT-04", "using"), `강점 문장 ${D.LINES.using}`);
  assert.equal(D.rootDirectionLine("ROOT-04", "unknown"), "");
});

test("motiveDomains: 취소·숨김 제외", () => {
  assert.deepEqual(motiveDomains([{ slot: "motive.work", value: null, observed_at: "t" }, { slot: "motive.rest", value: null, observed_at: "t", hidden_at: "x" }, { slot: "growth.aware", value: null, observed_at: "t" }]), ["work"]);
});
