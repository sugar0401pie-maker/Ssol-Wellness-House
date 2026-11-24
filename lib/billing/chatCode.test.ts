import { test } from "node:test";
import assert from "node:assert/strict";
import { CODE_ALPHABET, formatChatCode, generateChatCode, hashChatCode, normalizeChatCode, redeemMessage } from "./chatCode.ts";

test("입력은 대소문자·공백·하이픈을 무시하고, 영문·숫자 10~32자만 받는다", () => {
  assert.equal(normalizeChatCode(" abcd-efgh-jk23 "), "ABCDEFGHJK23");
  assert.equal(normalizeChatCode("ABCD EFGH JK23"), "ABCDEFGHJK23");
  assert.equal(normalizeChatCode("ABC123"), null); // 너무 짧음
  assert.equal(normalizeChatCode("ABCD-EFGH-JK2!"), null);
  assert.equal(normalizeChatCode(12345678901), null);
});

test("만든 코드: 12자 · 헷갈리는 글자(0·O·1·I·L) 없음 · 4자리씩 하이픈 · 같은 코드는 같은 지문", () => {
  const c = generateChatCode();
  assert.equal(c.length, 12);
  assert.ok([...c].every((ch) => CODE_ALPHABET.includes(ch)));
  assert.doesNotMatch(CODE_ALPHABET, /[0O1IL]/);
  assert.match(formatChatCode(c), /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal(normalizeChatCode(formatChatCode(c)), c);
  assert.equal(hashChatCode(c), hashChatCode(normalizeChatCode(formatChatCode(c).toLowerCase())!));
  assert.match(hashChatCode(c), /^[0-9a-f]{64}$/);
});

test("결과 문구가 모두 있다", () => {
  for (const r of ["ok", "not_found", "expired", "used_up", "already_yours", "invalid"] as const) assert.ok(redeemMessage(r).length > 5);
});
