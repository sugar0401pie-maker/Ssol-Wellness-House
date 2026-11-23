import { test } from "node:test";
import assert from "node:assert/strict";
import { usageRow } from "./usageRow.ts";

const U = "11111111-2222-4333-8444-555555555555";
const S = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

test("사용량 한 줄: 범위의 사용자·대화·기능 이름과 토큰 수만 담는다(내용 칸 없음)", () => {
  const r = usageRow({ route: "chat", userId: U, sessionId: S }, { feature: "chat_reply", model: "gpt-5.6-luna", inputTokens: 1819, outputTokens: 271 });
  assert.deepEqual(r, { user_id: U, session_id: S, route: "chat", feature: "chat_reply", model: "gpt-5.6-luna", input_tokens: 1819, output_tokens: 271 });
  assert.deepEqual(Object.keys(r).sort(), ["feature", "input_tokens", "model", "output_tokens", "route", "session_id", "user_id"]);
});

test("요청 밖에서 부르면 route는 background, 사용자 없음", () => {
  const r = usageRow(undefined, { feature: "embedding_batch", model: "text-embedding-3-small", inputTokens: 500, outputTokens: 0 });
  assert.equal(r.route, "background");
  assert.equal(r.user_id, null);
  assert.equal(r.session_id, null);
});

test("이상한 값은 걸러낸다: id가 uuid가 아니면 비우고, 토큰은 0 이상 정수", () => {
  const r = usageRow({ route: " ", userId: "anon", sessionId: "x" }, { feature: "", model: "", inputTokens: -5, outputTokens: Number.NaN });
  assert.equal(r.user_id, null);
  assert.equal(r.session_id, null);
  assert.equal(r.route, "background");
  assert.equal(r.feature, "unknown");
  assert.equal(r.model, "unknown");
  assert.equal(r.input_tokens, 0);
  assert.equal(r.output_tokens, 0);
  assert.equal(usageRow(undefined, { feature: "f", model: "m", inputTokens: 12.6, outputTokens: 3 }).input_tokens, 13);
});
