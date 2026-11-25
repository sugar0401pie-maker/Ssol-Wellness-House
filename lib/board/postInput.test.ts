import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPostInput } from "./postInput.ts";

test("고민 가이드: 주소 이름 형식·먼저 한 줄로 최대 3줄·태그의 # 빼기", () => {
  const r = checkPostInput({ kind: "guide", slug: " Is-This-Ssom ", tag: "#썸", title: "썸인지 헷갈릴 때", lines: ["a", "", "b", "c", "d"], body: "본문" });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.slug, "is-this-ssom");
    assert.equal(r.value.tag, "썸");
    assert.deepEqual(r.value.lines, ["a", "b", "c"]);
    assert.equal(r.value.published, true);
  }
  assert.equal(checkPostInput({ kind: "guide", slug: "썸", tag: "썸", title: "t", lines: ["a"] }).ok, false);
  assert.equal(checkPostInput({ kind: "guide", slug: "ok", tag: "썸", title: "t", lines: [] }).ok, false);
});

test("고민우체국: 회차 숫자·줄거리 필수, 숨기기", () => {
  const r = checkPostInput({ kind: "post", n: "4", tag: "이직", title: "4화", summary: "줄거리", published: false });
  assert.ok(r.ok && r.value.n === 4 && r.value.published === false);
  assert.equal(checkPostInput({ kind: "post", n: "x", tag: "a", title: "t", summary: "s" }).ok, false);
  assert.equal(checkPostInput({ kind: "post", n: 2, tag: "a", title: "t", summary: "" }).ok, false);
  assert.equal(checkPostInput({ kind: "nope" }).ok, false);
});
