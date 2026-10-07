// 이론 고르기 프롬프트와 답 해석 — 순수 함수(theoryAnswer.test.ts). AI 호출은 selectTheory.ts에서 한다.
export function buildSelectPrompt(theories: { id: string; focus: string; axes: string | null }[]): string {
  const desc = theories.map((t) => `${t.id}: ${t.focus}${t.axes ? ` [축: ${t.axes}]` : ""}`).join("\n");
  return `사용자의 고민 문장을 보고, 아래 상담 접근 중 가장 알맞은 것 하나를 고르세요. 알맞은 것이 없거나 문장이 너무 짧고 막연하면 NONE. 다른 말 없이 약어 하나만 답하세요.\n${desc}`;
}

// 모델의 답("ACT", "TH-ACT", "act." 등)을 허용된 이론 ID로 바꾼다. 목록에 없거나 여러 개를 말하면 null.
export function parseTheoryAnswer(answer: string, allowedIds: string[]): string | null {
  const a = answer.toUpperCase().replace(/[^A-Z]/g, "");
  if (!a || a === "NONE") return null;
  const found = allowedIds.find((id) => id === a || `TH${id}` === a);
  return found ?? null;
}
