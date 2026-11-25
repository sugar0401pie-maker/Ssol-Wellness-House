import { test } from "node:test";
import assert from "node:assert/strict";
import { extractMain, isAllowedUrl, sanitizeHtml } from "./sanitize.ts";

const BASE = "https://www.ssolwellnesshouse.com/guide/is-this-ssom";

test("가져올 수 있는 주소는 우리 사이트 https만", () => {
  assert.ok(isAllowedUrl("https://www.ssolwellnesshouse.com/guide/index.json"));
  assert.ok(isAllowedUrl("/guide/x", BASE));
  assert.ok(!isAllowedUrl("http://www.ssolwellnesshouse.com/guide"));
  assert.ok(!isAllowedUrl("https://evil.example/guide"));
  assert.ok(!isAllowedUrl("https://www.ssolwellnesshouse.com.evil.example/"));
  assert.ok(!isAllowedUrl("javascript:alert(1)", BASE));
  assert.ok(!isAllowedUrl("https://user:pw@www.ssolwellnesshouse.com/"));
});

test("스크립트·스타일·iframe은 내용째, 이벤트 속성·위험한 링크는 지운다", () => {
  const dirty = `<h2 onclick="x()">제목</h2><script>alert(1)</script><p style="color:red">본문 <b>굵게</b></p>
    <img src="x" onerror="alert(1)"><img src="/a.png" alt="그림"><a href="javascript:alert(1)">나쁜</a><a href="/guide/y">좋은</a>
    <iframe src="https://evil.example"></iframe><STYLE>p{}</STYLE><div><span>그냥 글</span></div><!-- 주석 --><script>안 닫힘`;
  const out = sanitizeHtml(dirty, BASE);
  assert.ok(!/script|onclick|onerror|style|iframe|javascript|주석|안 닫힘/i.test(out), out);
  assert.ok(out.includes("<h2>제목</h2>"));
  assert.ok(out.includes("<p>본문 <b>굵게</b></p>"));
  assert.ok(out.includes('<img src="https://www.ssolwellnesshouse.com/a.png" alt="그림" loading="lazy">'));
  assert.ok(!out.includes('src="x"') && !out.includes("evil"));
  assert.ok(out.includes('<a href="https://www.ssolwellnesshouse.com/guide/y" target="_blank" rel="noopener noreferrer">좋은</a>'));
  assert.ok(out.includes("<a>나쁜</a>"));
  assert.ok(out.includes("그냥 글") && !out.includes("<div") && !out.includes("<span"));
});

test("따옴표를 깨는 속성 값도 안전하게", () => {
  const out = sanitizeHtml(`<img src="/a.png" alt='x" onload="alert(1)'>`, BASE);
  assert.ok(!/onload="/.test(out), out);
});

test("본문만 꺼내기: article → main → body", () => {
  assert.equal(extractMain("<html><body><nav>메뉴</nav><main><p>본문</p></main></body></html>"), "<p>본문</p>");
  assert.equal(extractMain("<body><article><p>a</p></article></body>"), "<p>a</p>");
});
