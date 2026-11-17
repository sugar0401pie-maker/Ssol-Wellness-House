import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildBatches, MAX_EVALUATED_SESSIONS, parseBatchOutput, renderTranscript, sessionBlock, splitLabeled, SESSION_LABELS, SESSION_SYSTEM, OVERALL_SYSTEM } from "./reportPrompts.ts";
import type { SessionFact } from "./reportFacts.ts";

const sess = (i: number, text = "안녕하세요 요즘 힘들어요", level: SessionFact["level"] = null): SessionFact => ({
  code: `S${String(i + 1).padStart(2, "0")}`, sessionId: `s${i}`, startedAt: `2026-11-${String((i % 28) + 1).padStart(2, "0")}T02:00:00Z`, topic: `주제${i}`, level, reasons: [], deleted: false,
  messages: [
    { message_id: `u${i}`, session_id: `s${i}`, role: "user", content: text, route: null, framework_id: null, theory_id: null, technique_id: null, dialogue_mode: null, reflection_signal_id: null, created_at: "2026-11-01T00:00:00Z" },
    { message_id: `a${i}`, session_id: `s${i}`, role: "assistant", content: "많이 힘드셨겠어요. ".repeat(100), route: "wellness", framework_id: null, theory_id: null, technique_id: null, dialogue_mode: null, reflection_signal_id: null, created_at: "2026-11-01T00:01:00Z" },
  ],
});

describe("보고서 AI 요청·결과 나누기", () => {
  test("지시문에는 진단 금지·가설 표시·마크다운 금지가 들어 있다(안전 규칙)", () => {
    for (const s of [SESSION_SYSTEM, OVERALL_SYSTEM]) {
      assert.ok(s.includes("진단·병명·장애 이름을 붙이지 않습니다"));
      assert.ok(s.includes("가설:"));
      assert.ok(s.includes("주의 필요:"));
      assert.ok(s.includes("마크다운"));
    }
  });
  test("대화 글: 쏘웰라 답은 400자까지, 이용자 말은 그대로", () => {
    const t = renderTranscript(sess(0, "아주 긴 사연 ".repeat(10)));
    assert.ok(t.includes("이용자: 아주 긴 사연"));
    const bot = t.split("\n").find((l) => l.startsWith("쏘웰라:"))!;
    assert.ok(bot.length <= 410 && bot.endsWith("…"));
  });
  test("너무 길면 중간에서 끊고 생략 표시", () => {
    const long = sess(0, "가".repeat(9000));
    long.messages.push({ ...long.messages[0], message_id: "x", content: "나".repeat(9000) });
    assert.ok(renderTranscript(long).includes("(이하 길이 제한으로 생략)"));
  });
  test("묶음: 한 묶음 최대 8개, 최근 40개까지만, 순서 유지", () => {
    const b = buildBatches(Array.from({ length: 50 }, (_, i) => sess(i)));
    assert.ok(b.every((x) => x.length <= 8));
    const flat = b.flat();
    assert.equal(flat.length, MAX_EVALUATED_SESSIONS);
    assert.equal(flat[0].code, "S11");
    assert.equal(flat.at(-1)!.code, "S50");
    assert.deepEqual(buildBatches([]), []);
  });
  test("경고 대화는 머리줄에 경고 단계가 표시된다", () => {
    assert.ok(sessionBlock(sess(2, "x", "urgent")).startsWith("### S03 ·"));
    assert.ok(sessionBlock(sess(2, "x", "urgent")).includes("[경고 URGENT]"));
    assert.equal(sessionBlock(sess(2)).includes("[경고"), false);
  });
  test("결과 나누기: ### S번호 머리별로 나누고 모르는 번호·빠진 번호는 무시", () => {
    const m = parseBatchOutput("### S01\n핵심 주제와 감정: a\n### S02 · x\n핵심 주제와 감정: b\n### S99\nzzz", ["S01", "S02", "S03"]);
    assert.equal(m.get("S01"), "핵심 주제와 감정: a");
    assert.equal(m.get("S02"), "핵심 주제와 감정: b");
    assert.equal(m.has("S03"), false);
    assert.equal(m.has("S99"), false);
    assert.equal(parseBatchOutput("그냥 글", ["S01"]).size, 0);
  });
  test("머리말 나누기와 못 찾을 때의 대체", () => {
    const parts = splitLabeled("핵심 주제와 감정: 가\n관찰된 패턴(가설): 나\n쏘웰라 응답 점검: 다\n다음에 살펴볼 점: 라", SESSION_LABELS);
    assert.deepEqual(parts.map((p) => p.body), ["가", "나", "다", "라"]);
    assert.deepEqual(splitLabeled("머리말 없는 글", SESSION_LABELS), [{ label: "", body: "머리말 없는 글" }]);
    assert.deepEqual(splitLabeled("   ", SESSION_LABELS), []);
  });
});
