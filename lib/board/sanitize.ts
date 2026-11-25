// 공개 사이트 글을 앱에 보여 줄 때 허용한 태그만 남긴다(요청문 10-2장: 제목·문단·목록·강조·링크·이미지). 외부 글을 그대로 HTML로 넣지 않는다.
// 스크립트·스타일·iframe 등은 내용째 지우고, 모든 속성을 버린 뒤 a의 href(우리 사이트 https만)와 img의 src(우리 사이트만)·alt만 다시 붙인다.
// 가져올 수 있는 주소도 우리 도메인만(isAllowedUrl). 순수 함수 — 서버에서 쓰고 테스트한다.
export const ALLOWED_HOSTS = ["www.ssolwellnesshouse.com", "ssolwellnesshouse.com"];

export function isAllowedUrl(u: string, base?: string): boolean {
  return resolveAllowed(u, base) !== null;
}
function resolveAllowed(u: string, base?: string): string | null {
  try {
    const url = new URL(u.trim(), base);
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.includes(url.hostname) || url.username || url.password || url.port) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const KEEP = new Set(["h1", "h2", "h3", "h4", "p", "ul", "ol", "li", "strong", "em", "b", "i", "a", "img", "br", "blockquote"]);
const DROP_WITH_CONTENT = ["script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "math", "form", "button", "select", "textarea", "head", "title", "video", "audio", "canvas"];
const VOID = new Set(["img", "br"]);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function attrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
  return out;
}

export function sanitizeHtml(html: string, base: string): string {
  let s = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const t of DROP_WITH_CONTENT) {
    s = s.replace(new RegExp(`<${t}\\b[\\s\\S]*?<\\/${t}\\s*>`, "gi"), "");
    s = s.replace(new RegExp(`<${t}\\b[^>]*>[\\s\\S]*$`, "gi"), ""); // 닫히지 않은 것은 끝까지 지운다
  }
  return s
    .split(/(<[^>]*>)/g)
    .map((tok) => {
      if (!tok.startsWith("<")) return tok.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const m = /^<\s*(\/)?\s*([a-zA-Z0-9]+)([^>]*)>$/.exec(tok);
      if (!m) return "";
      const closing = !!m[1];
      const name = m[2].toLowerCase();
      if (!KEEP.has(name)) return "";
      if (closing) return VOID.has(name) ? "" : `</${name}>`;
      const a = attrs(m[3]);
      if (name === "a") {
        const href = a.href ? resolveAllowed(a.href, base) : null;
        return href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">` : "<a>";
      }
      if (name === "img") {
        const src = a.src ? resolveAllowed(a.src, base) : null;
        return src ? `<img src="${esc(src)}" alt="${esc(a.alt ?? "")}" loading="lazy">` : "";
      }
      return `<${name}>`;
    })
    .join("")
    .trim();
}

// 글 페이지에서 본문만 — <article> → <main> → <body> 순서로 찾는다.
export function extractMain(html: string): string {
  for (const t of ["article", "main", "body"]) {
    const m = new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)<\\/${t}>`, "i").exec(html);
    if (m) return m[1];
  }
  return html;
}
