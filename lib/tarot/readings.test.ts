import { test } from "node:test";
import assert from "node:assert/strict";
import { toReading, buildTarotHint, type TarotRow } from "./readings.ts";

const row: TarotRow = {
  id: "a",
  created_at: "2026-10-05T10:00:00Z",
  picks: [
    { id: "splash", reversed: false, position: "now" },
    { id: "puffed", reversed: true, position: "hold" },
    { id: "rock_rest", reversed: false, position: "step" },
  ],
  classification: { domain: "LOV", emotions: ["HUR", "LON"], need: "CONNECT", self_focus: false },
  worry_skipped: false,
};

test("카드 이름·위치·방향과 분류 이름으로 바꾼다", () => {
  const r = toReading(row, "https://t")!;
  assert.equal(r.cards[1].name, "부풀어 오른 마음");
  assert.equal(r.cards[1].reversed, true);
  assert.equal(r.cards[1].positionName, "나를 붙잡는 것");
  assert.equal(r.cards[0].image, "https://t/images/tarot/card-00-splash.webp");
  assert.deepEqual(r.topic, { domain: "연애", emotions: ["서운함", "외로움"], need: "연결" });
});

test("3장을 다 뽑지 않았거나 모르는 카드면 제외", () => {
  assert.equal(toReading({ ...row, picks: row.picks!.slice(0, 2) }, ""), null);
  assert.equal(toReading({ ...row, picks: [...row.picks!.slice(0, 2), { id: "x", reversed: false, position: "step" }] }, ""), null);
});

test("고민 미작성·장난 글·self_focus 처리", () => {
  assert.equal(toReading({ ...row, classification: null, worry_skipped: true }, "")!.topic, null);
  assert.equal(toReading({ ...row, classification: { ...row.classification, off_topic: true } }, "")!.topic, null);
  assert.equal(toReading({ ...row, classification: { domain: "DIR", emotions: ["SHA"], need: "LETGO", self_focus: true } }, "")!.topic!.domain, "나 자신과 삶의 방향");
});

test("채팅 힌트: 최근 결과만, 고민 원문은 들어가지 않는다", () => {
  const r = toReading(row, "")!;
  const hint = buildTarotHint([r], new Date("2026-10-07T10:00:00Z"))!;
  assert.match(hint, /2일 전/);
  assert.match(hint, /부풀어 오른 마음\(복어\) · 역방향/);
  assert.match(hint, /연애/);
  assert.equal(buildTarotHint([r], new Date("2026-12-01T00:00:00Z")), null);
  assert.equal(buildTarotHint([], new Date()), null);
});

test("고민 미작성이면 그렇게 적는다", () => {
  const r = toReading({ ...row, classification: null, worry_skipped: true }, "")!;
  assert.match(buildTarotHint([r], new Date("2026-10-05T12:00:00Z"))!, /오늘.*마음속으로만/);
});
