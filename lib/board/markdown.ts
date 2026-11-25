// 고민 타파 글 본문의 간단한 서식 → HTML(2026-11-25). 대표님이 관리자 화면에 붙여 넣는 글을 읽기 좋게.
//   빈 줄 = 문단 나눔 · "## " 소제목 · "### " 작은 소제목 · "- " 목록 · "1. " 번호 목록 · "> " 인용 · **굵게** · [글자](주소)
// 글자는 먼저 모두 이스케이프하고 위 서식만 태그로 바꾼다 — 그 뒤에 sanitizeHtml(허용 태그만, 링크·그림은 우리 사이트만)을 한 번 더 거친다.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a href="$2">$1</a>');
}

export function renderBody(src: string): string {
  const blocks = src.replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/);
  return blocks
    .map((b) => {
      const lines = b.split("\n").map((l) => l.trimEnd());
      if (lines.length === 1 && /^###\s+/.test(lines[0])) return `<h3>${inline(lines[0].replace(/^###\s+/, ""))}</h3>`;
      if (lines.length === 1 && /^##\s+/.test(lines[0])) return `<h2>${inline(lines[0].replace(/^##\s+/, ""))}</h2>`;
      if (lines.every((l) => /^[-*]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
      if (lines.every((l) => /^\d+[.)]\s+/.test(l))) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+[.)]\s+/, ""))}</li>`).join("")}</ol>`;
      if (lines.every((l) => /^>\s?/.test(l))) return `<blockquote><p>${lines.map((l) => inline(l.replace(/^>\s?/, ""))).join("<br>")}</p></blockquote>`;
      return `<p>${lines.map(inline).join("<br>")}</p>`;
    })
    .filter((h) => h !== "<p></p>")
    .join("");
}
