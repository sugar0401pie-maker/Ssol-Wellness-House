// 테스트를 하고 채팅에 들어온 경로(주소) → 첫 메시지를 만들 결과. 브라우저·서버 모두 쓰므로 "server-only"를 넣지 않는다.
// 타로: /chat?from=tarot&result=<id> · 점성술: /chat?from=astro&result=<id> · 디저트 유형 테스트: /chat?from=quiz
export type TestOpeningSource = { kind: "tarot"; resultId: string } | { kind: "astro"; resultId: string | null } | { kind: "quiz" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function testOpeningSourceFrom(search: string): TestOpeningSource | null {
  const q = new URLSearchParams(search);
  const from = q.get("from");
  const r = q.get("result");
  if (from === "tarot") return r && UUID.test(r) ? { kind: "tarot", resultId: r } : null;
  if (from === "astro") return { kind: "astro", resultId: r && UUID.test(r) ? r : null };
  if (from === "quiz") return { kind: "quiz" };
  return null;
}

export const testOpeningKey = (s: TestOpeningSource): string => (s.kind === "quiz" ? "quiz" : `${s.kind}:${s.resultId ?? "latest"}`);

// 말풍선은 꾸밈 없는 글(대화 기본 규칙) — 모델이 마크다운을 섞으면 걷어 낸다. 너무 짧거나 길면 쓰지 않는다.
export function cleanOpening(text: string): string | null {
  const t = text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return t.length >= 30 && t.length <= 1200 ? t : null;
}
