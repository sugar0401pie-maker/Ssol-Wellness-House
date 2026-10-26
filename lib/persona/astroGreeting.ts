// 쏠 아스트로 하우스(점성술) 결과에서 넘어온 사용자에게 보여 줄 맞춤 첫 인사(2026-10-26, 대표님 결정 (가)).
// 점성술 앱이 결과마다 astro_results.chat_summary 끝에 "[9. 대화 시작 정보] … 첫 인사 문장: {문장}"을 만들어 둔다
// (그쪽 해석 DB B15 — 닉네임·태양 별자리·바라는 것·올해의 단어로 채운 문장, 올해를 '고생'·'이별'로 고른 사람은 부드러운 문장).
// 이 파일은 브라우저·서버 모두에서 쓰므로 "server-only"를 넣지 않는다. 별자리 이름은 대표님 결정으로 그대로 쓴다.

/** 점성술 '[쏘웰라와 대화 시작하기]' 버튼이 붙이는 주소 표시: /chat?from=astro&result=<결과 id> */
export const ASTRO_OPENING_FROM = "astro";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AstroOpening = { resultId: string | null };

/** 주소 쿼리(?from=astro&result=…)에서 점성술 진입 여부를 읽는다. 결과 id는 uuid 모양일 때만 쓴다. */
export function astroOpeningFromSearch(search: string): AstroOpening | null {
  const q = new URLSearchParams(search);
  if (q.get("from") !== ASTRO_OPENING_FROM) return null;
  const r = q.get("result");
  return { resultId: r && UUID_RE.test(r) ? r : null };
}

/** 채팅 요청 본문의 opening 값을 검사한다(모양만 — 실제 문장은 서버가 DB에서 다시 읽는다). */
export function parseAstroOpening(v: unknown): AstroOpening | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { from?: unknown; resultId?: unknown };
  if (o.from !== ASTRO_OPENING_FROM) return null;
  return { resultId: typeof o.resultId === "string" && UUID_RE.test(o.resultId) ? o.resultId : null };
}

/** chat_summary에서 첫 인사 문장만 꺼낸다. 없거나 비정상이면 null(그러면 기본 환영 인사를 쓴다). */
export function extractAstroGreeting(summary: unknown): string | null {
  if (typeof summary !== "string") return null;
  const line = summary.split("\n").find((l) => l.startsWith("[9. 대화 시작 정보]"));
  const m = line?.match(/첫 인사 문장:\s*(.+)$/);
  const text = m?.[1]?.trim() ?? "";
  // 지나치게 길거나 짧으면 쓰지 않는다(형식이 깨진 경우를 막는 안전장치)
  return text.length >= 10 && text.length <= 400 ? text : null;
}
