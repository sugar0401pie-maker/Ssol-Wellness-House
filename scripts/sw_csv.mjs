// CSV 읽기(RFC4180): 따옴표·줄바꿈·"" 이스케이프, BOM, 따옴표 없는 빈 칸 = NULL, 따옴표 있는 빈 칸 = 빈 문자열
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = []; let row = [], f = "", q = false, quotedField = false, i = 0;
  const push = () => { row.push(quotedField || f !== "" ? f : null); f = ""; quotedField = false; };
  while (i < text.length) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; }
      f += ch; i++; continue;
    }
    if (ch === '"') { q = true; quotedField = true; i++; continue; }
    if (ch === ",") { push(); i++; continue; }
    if (ch === "\r") { i++; continue; }
    if (ch === "\n") { push(); rows.push(row); row = []; i++; continue; }
    f += ch; i++;
  }
  if (f !== "" || quotedField || row.length) { push(); rows.push(row); }
  return rows;
}
