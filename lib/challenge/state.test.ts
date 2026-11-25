import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, bannerCopy, dayDiff, deriveView, needsToday, normalizeMemo, resultLine, startDayFor, type Challenge, type Checkin } from "./state.ts";
import { CHALLENGE_THEMES, themeOf } from "./themes.ts";

const T = "2026-11-26";
const ck = (n: number, day: string): Checkin => ({ n, day, method: "photo", memo: null, action: "a" });
const ch = (startedDay: string, checkins: Checkin[]): Challenge => ({ id: "c", seq: 1, theme: "worry", startedDay, status: "active", endedDay: null, endReason: null, checkins });

test("날짜 계산(KST 날짜 문자열): 월·해 넘김", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(dayDiff("2027-01-02", "2026-12-31"), 2);
});

test("시작 전: 리워드를 받은 사람에게는 '깜짝 리워드' 줄을 빼요", () => {
  assert.equal(deriveView(null, T, false).msg, "시작하면 그날이 1일차예요. 챌린지 종료 이후에 깜짝 리워드가 있어요!");
  assert.equal(deriveView(null, T, true).msg, "시작하면 그날이 1일차예요.");
  assert.equal(deriveView(null, T, false).button.op, "start");
  assert.equal(deriveView(null, T, false).todayLine, "");
});

test("진행: N번째 저장이 N일차, 하루 한 번, 오늘 저장 뒤 '내일은 N+1일차예요'", () => {
  let v = deriveView(ch(T, []), T, false);
  assert.equal(v.kind, "todo"); assert.equal(v.todayLine, "오늘은 1일차"); assert.equal(v.msg, "시작했어요! 오늘이 1일차예요. 가볍게 해봐요~");
  assert.ok(needsToday(v));
  v = deriveView(ch(T, [ck(1, T)]), T, false);
  assert.equal(v.kind, "doneToday"); assert.equal(v.msg, "1일차 완료 대박~! 내일은 2일차예요."); assert.equal(v.button.enabled, false);
  assert.equal(v.button.label, "오늘 인증 끝! 내일은 2일차예요~");
  assert.ok(!needsToday(v));
  v = deriveView(ch(T, [ck(1, T)]), addDays(T, 1), false);
  assert.equal(v.todayLine, "오늘은 2일차"); assert.equal(v.msg, "오늘도 하나만 해봐요~"); assert.equal(v.dayIndex, 1);
  v = deriveView(ch(T, [ck(1, T)]), addDays(T, 3), false);
  assert.equal(v.msg, "어제는 쉬었죠? 괜찮아요, 오늘부터 이어서 가요~");
  v = deriveView(ch(T, [ck(1, T), ck(2, addDays(T, 1))]), addDays(T, 1), false);
  assert.equal(v.msg, "2일차도 해냈네요 짱이에요~! 내일은 3일차예요. 하나만 더 하면 완료예요.");
});

test("7일 안 누적 3번: 7일째(시작+6)까지는 이어 가고, 그 뒤엔 '다시 시작'", () => {
  const c = ch(T, [ck(1, T)]);
  assert.equal(deriveView(c, addDays(T, 6), false).kind, "todo");
  const v = deriveView(c, addDays(T, 7), false);
  assert.equal(v.kind, "expired"); assert.equal(v.button.label, "다시 시작");
  assert.equal(v.msg, "이번엔 여기까지 왔어요. 괜찮아요, 다시 해봐요. 또 할 수 있어요~");
});

test("3번 완료: 며칠 뒤에 와도 완료 화면, 버튼은 또심삼일", () => {
  const c = ch(T, [ck(1, T), ck(2, addDays(T, 1)), ck(3, addDays(T, 4))]);
  for (const d of [addDays(T, 4), addDays(T, 30)]) {
    const v = deriveView(c, d, false);
    assert.equal(v.kind, "complete"); assert.equal(v.todayLine, "와! 3일차 챌린지를 완료했어요!"); assert.equal(v.button.label, "다시 챌린지 하기 (또심삼일!)");
  }
  assert.equal(bannerCopy(deriveView(c, T, false)), null);
});

test("같은 날 끝내고 바로 새로 시작하면 1일차는 내일", () => {
  assert.equal(startDayFor(T, true), addDays(T, 1));
  assert.equal(startDayFor(T, false), T);
  const v = deriveView(ch(addDays(T, 1), []), T, true);
  assert.equal(v.kind, "wait"); assert.equal(v.todayLine, "내일이 1일차예요"); assert.equal(v.button.enabled, false);
  assert.equal(deriveView(ch(addDays(T, 1), []), addDays(T, 1), true).todayLine, "오늘은 1일차");
});

test("홈 배너 ②·결과 화면 문구", () => {
  assert.deepEqual(bannerCopy(deriveView(null, T, false)), { title: "쏠 작심삼일 챌린지", desc: "3일만 해봐요. 하루 쉬어도 괜찮아요." });
  assert.deepEqual(bannerCopy(deriveView(ch(T, []), T, false)), { title: "오늘은 1일차", desc: "사진 한 줄로 인증하러 가기" });
  assert.deepEqual(bannerCopy(deriveView(ch(T, [ck(1, T)]), T, false)), { title: "오늘 1일차 완료", desc: "내일은 2일차예요" });
  assert.equal(resultLine(1), "1일차 도장을 찍었어요. 내일은 2일차예요.");
  assert.equal(resultLine(3), "3일을 모두 채웠어요!");
});

test("메모: 공백 정리, 40자에서 자름, 비면 null · 테마 3가지와 기본값", () => {
  assert.equal(normalizeMemo("  오늘  하늘\n예뻤다 "), "오늘 하늘 예뻤다");
  assert.equal(normalizeMemo("   "), null);
  assert.equal([...normalizeMemo("가".repeat(50))!].length, 40);
  assert.equal(CHALLENGE_THEMES.length, 3);
  assert.equal(themeOf("nope").key, "worry");
  assert.equal(themeOf("energy").days[2].action, "오늘 먹은 것 중 제일 맛있는 것 찍기");
});
