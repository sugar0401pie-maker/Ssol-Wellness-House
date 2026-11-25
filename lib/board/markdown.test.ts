import { test } from "node:test";
import assert from "node:assert/strict";
import { renderBody } from "./markdown.ts";
import { sanitizeHtml } from "./sanitize.ts";

test("간단한 서식: 소제목·문단·목록·굵게·줄바꿈", () => {
  const html = renderBody("## 먼저 살펴볼 것\n\n첫 문단이에요.\n같은 문단 둘째 줄\n\n- 하나\n- **둘**\n\n1. 첫째\n2. 둘째\n\n> 인용");
  assert.equal(html, "<h2>먼저 살펴볼 것</h2><p>첫 문단이에요.<br>같은 문단 둘째 줄</p><ul><li>하나</li><li><strong>둘</strong></li></ul><ol><li>첫째</li><li>둘째</li></ol><blockquote><p>인용</p></blockquote>");
});

test("붙여 넣은 HTML·스크립트는 글자로만 보이고, 링크는 우리 사이트만 살아남는다", () => {
  const html = sanitizeHtml(renderBody('<script>alert(1)</script> [좋은](/board) [나쁜](https://evil.example/x) <img src=x onerror=alert(1)>'), "https://app.ssolwellnesshouse.com/board/guide/x");
  assert.ok(!/<script|<img|evil/.test(html), html); // 붙여 넣은 태그는 글자(&lt;…&gt;)로만 남는다
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes('<a href="https://app.ssolwellnesshouse.com/board" target="_blank" rel="noopener noreferrer">좋은</a>'));
  assert.ok(html.includes("<a>나쁜</a>"));
});
