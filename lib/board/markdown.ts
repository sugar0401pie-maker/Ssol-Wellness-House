// 고민 타파 글 본문의 간단한 서식 → HTML(2026-11-25). 대표님이 관리자 화면에 붙여 넣는 글을 읽기 좋게.
//   빈 줄 = 문단 나눔 · "## " 소제목 · "### " 작은 소제목 · "- " 목록 · "1. " 번호 목록 · "> " 인용 · **굵게** · [글자](주소)
// 글자는 먼저 모두 이스케이프하고 위 서식만 태그로 바꾼다 — 그 뒤에 sanitizeHtml(허용 태그만, 링크·그림은 우리 사이트만)을 한 번 더 거친다.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a href="$2">$1</a>');
}

// 한 줄씩 읽어 묶는다 — 소제목 바로 아래 줄, 목록 바로 위 문장처럼 빈 줄이 없어도 나뉜다(고민우체국 글 형식).
type Kind = "p" | "ul" | "ol" | "quote";
export function renderBody(src: string): string {
  const out: string[] = [];
  let kind: Kind | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (!kind || buf.length === 0) {
      kind = null;
      buf = [];
      return;
    }
    if (kind === "p") out.push(`<p>${buf.map(inline).join("<br>")}</p>`);
    if (kind === "ul") out.push(`<ul>${buf.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`);
    if (kind === "ol") out.push(`<ol>${buf.map((l) => `<li>${inline(l)}</li>`).join("")}</ol>`);
    if (kind === "quote") {
      const paras = buf.join("\n").split(/\n\s*\n/).map((p) => p.split("\n").map(inline).join("<br>"));
      out.push(`<blockquote>${paras.filter(Boolean).map((p) => `<p>${p}</p>`).join("")}</blockquote>`);
    }
    kind = null;
    buf = [];
  };
  const push = (k: Kind, text: string) => {
    if (kind !== k) flush();
    kind = k;
    buf.push(text);
  };
  for (const raw of src.replace(/\r\n?/g, "\n").split("\n")) {
    const l = raw.trimEnd();
    if (!l.trim()) {
      if (kind === "quote") buf.push("");
      else flush();
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = l.match(/^(#{1,3})\s+(.*)$/))) {
      flush();
      out.push(m[1].length === 3 ? `<h3>${inline(m[2])}</h3>` : `<h2>${inline(m[2])}</h2>`);
    } else if ((m = l.match(/^>\s?(.*)$/))) push("quote", m[1]);
    else if ((m = l.match(/^[-*]\s+(.*)$/))) push("ul", m[1]);
    else if ((m = l.match(/^\d+[.)]\s+(.*)$/))) push("ol", m[1]);
    else push("p", l.trim());
  }
  flush();
  return out.join("");
}
