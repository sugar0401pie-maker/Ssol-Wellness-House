import { test } from "node:test";
import assert from "node:assert/strict";
import { BRANCH_ASK, BRANCH_ASK_MORE, branchCardPayload, branchCardState, branchPickAllowed, concernKeyFor, decideBranch, isKnownBranch, unknownBranch } from "./branch.ts";
import { parseCardPick, tapMarker } from "../cards/flow.ts";
import { taskOfferText, TASK_OFFER_TEXT } from "../tasks/flow.ts";

test("갈래 정하기: 모델 답이 있으면 그대로 — 모델이 '까닭 없음'이라 하면 낱말 맞춤으로 뒤집지 않는다", () => {
  assert.deepEqual(decideBranch("WK-QUIT", { branch_id: "WK-QUIT-2", known: true, also: [] }, null), { branch_id: "WK-QUIT-2", known: true, by: "model", also: [] });
  const none = decideBranch("WK-QUIT", { branch_id: "WK-QUIT-0", known: false, also: [] }, { branch_id: "WK-QUIT-5", known: true });
  assert.equal(none.branch_id, "WK-QUIT-0");
  assert.equal(none.known, false);
});

test("갈래 정하기: 모델이 실패하면(fallback 또는 답 없음) 낱말 맞춤, 그것도 없으면 세부 코드-0", () => {
  assert.deepEqual(decideBranch("WK-QUIT", null, { branch_id: "WK-QUIT-5", known: true }), { branch_id: "WK-QUIT-5", known: true, by: "guess" });
  assert.equal(decideBranch("WK-QUIT", { branch_id: "WK-QUIT-0", known: false, fallback: "parse" }, { branch_id: "WK-QUIT-1", known: true }).by, "guess");
  assert.deepEqual(decideBranch("WK-QUIT", null, null), { branch_id: "WK-QUIT-0", known: false, by: "none" });
  assert.equal(unknownBranch("CR-MIND"), "CR-MIND-0");
  assert.equal(isKnownBranch({ branch_id: "CR-MIND-0", known: true }), false);
  assert.equal(isKnownBranch({ branch_id: "CR-MIND-2", known: true }), true);
});

const card = { intent_id: "WK-QUIT", ask: "이 중에 지금 마음에 가까운 까닭이 있어요?", more: false, options: [
  { id: "WK-QUIT-1", text: "일이 너무 많아서요", option_id: null }, { id: "WK-QUIT-2", text: "사람이 힘들어서요", option_id: "CO-X" }, { id: "other", text: "다른 까닭이에요" }, { id: "unknown", text: "잘 모르겠어요" },
] };

test("갈래 카드: 화면 모양과 보여 준 보기만 받기(한 번만)", () => {
  const p = branchCardPayload(card);
  assert.equal(p.kind, "branch");
  assert.equal(p.text, BRANCH_ASK); // 2026-11-24 A안 — 엔진 초안 문구 대신
  assert.deepEqual(p.options.map((o) => o.id), ["WK-QUIT-1", "WK-QUIT-2", "other", "unknown"]);
  assert.deepEqual(p.options.slice(2).map((o) => o.label), ["다른 이유예요", "잘 모르겠어요"]);
  assert.equal(p.options[0].label, "일이 너무 많아서요"); // 갈래 문장은 그대로
  assert.equal(branchCardPayload({ ...card, more: true }).text, BRANCH_ASK_MORE);
  assert.doesNotMatch(JSON.stringify(p), /까닭/);
  const st = branchCardState(card, "2026-11-23T00:00:00Z");
  assert.equal(branchPickAllowed(st, "WK-QUIT-2"), true);
  assert.equal(branchPickAllowed(st, "WK-QUIT-9"), false); // 보여 주지 않은 보기
  assert.equal(branchPickAllowed({ ...st, answered: true }, "WK-QUIT-2"), false); // 이미 답함
  assert.equal(branchPickAllowed(null, "WK-QUIT-2"), false);
});

test("갈래 카드 답 요청 모양 검사 · 하루 메시지 수에서 빼는 표시", () => {
  assert.deepEqual(parseCardPick({ branch: { option: "WK-QUIT-2" } }), { branch: { option: "WK-QUIT-2" } });
  assert.deepEqual(parseCardPick({ branch: { option: "other" } }), { branch: { option: "other" } });
  assert.equal(parseCardPick({ branch: { option: "<script>" } }), null);
  assert.equal(parseCardPick({ branch: null }), null);
  assert.equal(tapMarker({ branch: { option: "unknown" } }), "sw-cardtap:branch");
});

test("과제로 바로 갈 때 고민 키: 장면 → 장면 후보 → 세부 고민 코드", () => {
  assert.equal(concernKeyFor({ intent_id: "WK-QUIT", scene_key: "job_change", scene_candidate: null }), "job_change");
  assert.equal(concernKeyFor({ intent_id: "WK-REASSIGN", scene_key: null, scene_candidate: "job_dept" }), "job_dept");
  assert.equal(concernKeyFor({ intent_id: "FM-KID", scene_key: null, scene_candidate: null }), "FM-KID");
});

test("연습 안내 글: 갈래 행동이 있으면 평문으로 앞에 두 가지까지(마크다운 없음)", () => {
  assert.equal(taskOfferText([]), TASK_OFFER_TEXT);
  const t = taskOfferText(["과자 같은 작은 선물로 마음 전해 보기", "먼저 카톡해 보기", "세 번째는 안 나옴"]);
  assert.match(t, /① 과자 같은 작은 선물로 마음 전해 보기\n② 먼저 카톡해 보기/);
  assert.doesNotMatch(t, /세 번째|\*\*|^- /m);
  assert.ok(t.endsWith(TASK_OFFER_TEXT));
});
