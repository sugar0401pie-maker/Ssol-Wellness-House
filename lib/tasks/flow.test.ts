import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCardPick, tapMarker, isTaskPick } from "../cards/flow.ts";
import { TASK_OFFER_ENDINGS, pathOptionIds, taskOfferPayload, taskChosenReply, taskOpeningPayload, taskCheckPayload, taskCheckReply, RESULT_ACK } from "./flow.ts";

test("과제 누름 파싱: 모양이 맞을 때만 받는다(행 id는 양의 정수, 결과·확인 답은 정해진 값만)", () => {
  assert.deepEqual(parseCardPick({ task: { row: 12, practice: "RPD-001" } }), { task: { row: 12, practice: "RPD-001" } });
  assert.deepEqual(parseCardPick({ task: { row: 12, practice: "later" } }), { task: { row: 12, practice: "later" } });
  assert.equal(parseCardPick({ task: { row: -1, practice: "RPD-001" } }), null);
  assert.equal(parseCardPick({ task: { row: 1.5, practice: "RPD-001" } }), null);
  assert.equal(parseCardPick({ task: { row: 3, practice: "<script>" } }), null);
  assert.deepEqual(parseCardPick({ taskResult: { row: 3, result: "조금" } }), { taskResult: { row: 3, result: "조금" } });
  assert.equal(parseCardPick({ taskResult: { row: 3, result: "완벽" } }), null);
  assert.deepEqual(parseCardPick({ taskCheck: { row: 3, answer: "그대로예요" } }), { taskCheck: { row: 3, answer: "그대로예요" } });
  assert.equal(parseCardPick({ taskCheck: { row: 3, answer: "몰라" } }), null);
});

test("과제 누름은 탭 표시가 붙어 하루·대화당 메시지 수에서 빠진다", () => {
  const p = parseCardPick({ taskResult: { row: 3, result: "다 함" } })!;
  assert.ok(isTaskPick(p));
  assert.match(tapMarker(p), /^sw-cardtap:task-result$/);
  assert.equal(isTaskPick(parseCardPick({ cardId: "CC-A-1", optionId: "CO-A-1" })), false);
});

test("연습은 확인으로 끝난 카드에서만 — 아니라고 했거나 멈춘 자리에서는 건네지 않는다", () => {
  for (const r of ["confirmed", "confirm_partial", "confirm_weak", "deficit_hypothesis"]) assert.ok(TASK_OFFER_ENDINGS.has(r));
  for (const r of ["no_root", "no_root_confirm_skipped", "already_confirmed", "max_cards"]) assert.ok(TASK_OFFER_ENDINGS.has(r)); // 3부-4: 끝까지 답한 길
  for (const r of ["confirm_rejected", "user_stop", "dont_know", "free_text", "expired", "choice_unmatched", "corrected"]) assert.equal(TASK_OFFER_ENDINGS.has(r), false);
});

test("카드 길 → 고른 보기 id(고정 버튼·건너뛰기 빼고, 두 개 고른 건 둘 다)", () => {
  assert.deepEqual(pathOptionIds([{ card: "C1", pick: "O1" }, { card: "C2", pick: "FX-DK" }, { card: "C2", pick: "JUMP", to: "C3" }, { card: "C3", pick: "O3+O4" }]), ["O1", "O3", "O4"]);
  assert.deepEqual(pathOptionIds(null), []);
});

const task = { practice_id: "RPD-1", plan: { title: "하루 한 줄 마음 적기", minutes: "5분", first_step: "메모 앱을 열어요." } };

test("연습 카드: 제목(분), 지금은 괜찮아요 버튼, 행 id", () => {
  const c = taskOfferPayload(7, [task, { practice_id: "X-2", plan: { title: "산책" } }]);
  assert.equal(c.kind, "task");
  assert.equal(c.row, 7);
  assert.deepEqual(c.options, [{ id: "RPD-1", label: "하루 한 줄 마음 적기 (5분)" }, { id: "X-2", label: "산책" }]);
  assert.deepEqual(c.fixed.map((f) => f.id), ["FX-LATER"]);
  assert.match(c.text, /안 골라도 괜찮아요/);
});

test("고른 뒤 답: 첫 행동을 알려 주고 다음에 가볍게 묻겠다고 — 거절·명령 말투 없음", () => {
  const r = taskChosenReply(task);
  assert.match(r, /하루 한 줄 마음 적기/);
  assert.match(r, /메모 앱을 열어요/);
  assert.doesNotMatch(r, /할 수 없어요|해야 해요|반드시/);
});

test("다음 대화 첫머리·확인 카드·마무리", () => {
  const o = taskOpeningPayload(9, "다시 오셨네요! 지난번에 고른 거, 해 보니 어땠어요?", "산책");
  assert.equal(o.kind, "task_result");
  assert.deepEqual(o.options.map((x) => x.id), ["다 함", "조금", "못 함"]);
  assert.match(o.text, /‘산책’/);
  const c = taskCheckPayload(9, RESULT_ACK.effort, "덜 버겁게 느껴졌나요?", ["조금 나아졌어요", "그대로예요"]);
  assert.equal(c.kind, "task_check");
  assert.match(c.text, /한 걸음/);
  assert.match(taskCheckReply("더 버거웠어요"), /더 가벼운/);
  assert.doesNotMatch(RESULT_ACK.no_blame, /왜|해야/);
});

test("3부-4 누름 파싱: 질문 답은 0~9 번호, 지금 해 보기는 now/later만", async () => {
  const { parseCardPick: parse } = await import("../cards/flow.ts");
  assert.deepEqual(parse({ taskAsk: { row: 4, option: 1 } }), { taskAsk: { row: 4, option: 1 } });
  assert.equal(parse({ taskAsk: { row: 4, option: 12 } }), null);
  assert.equal(parse({ taskAsk: { row: 4, option: "1" } }), null);
  assert.deepEqual(parse({ taskMini: { row: 4, choice: "now" } }), { taskMini: { row: 4, choice: "now" } });
  assert.equal(parse({ taskMini: { row: 4, choice: "maybe" } }), null);
  assert.match(tapMarker(parse({ taskAsk: { row: 4, option: 0 } })!), /task-ask$/);
});

test("3부-4 카드: 질문 보기는 번호 id, 지금 해 보기는 고른 답 + 초대 문장", async () => {
  const { taskAskPayload, taskMiniPayload, miniNowText } = await import("./flow.ts");
  const a = taskAskPayload(5, "요즘만 그런가요?", [{ text: "요즘만 그래요" }, { text: "오래됐어요" }]);
  assert.deepEqual(a.options.map((o) => o.id), ["0", "1"]);
  assert.equal(a.kind, "task_ask");
  const m = taskMiniPayload(5, "좋아요, ‘산책’ 해 보기로 해요.", "지금 3분만 같이 해 볼까요?", "숨 고르기", false);
  assert.match(m.text, /해 보기로 해요[\s\S]*3분만 같이[\s\S]*‘숨 고르기’를 짧게 맛보는/);
  assert.deepEqual(m.options.map((o) => o.id), ["now", "later"]);
  assert.match(miniNowText("숨 고르기", 3, "편하게 앉아요."), /3분만 같이 해 봐요[\s\S]*편하게 앉아요/);
});

test("지금 같이 해 보기 실천은 검수 대기여도 내보낸다(대표님 2026-11-19) — 다른 초안은 그대로", async () => {
  const { releaseInSession } = await import("./flow.ts");
  const d = { review: { "RIN-01": "draft", "RP-037": "approved", "STF-9": "draft" } as Record<string, string | null>, in_session: ["RIN-01", "RP-037"] };
  assert.equal(releaseInSession(d), 1);
  assert.equal(d.review["RIN-01"], "approved");
  assert.equal(d.review["STF-9"], "draft");
});
