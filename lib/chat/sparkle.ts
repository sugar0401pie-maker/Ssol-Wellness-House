// 쏘웰라 말투를 조금 부드럽게 — 대화 처음 인사와 마지막 마무리 인사에 별가루 기호 하나(대표님 2026-11-27: "말투가 살짝 딱딱하다는 이야기",
// "처음에 인사하고 마지막에 종료할 때"). 기호는 대표님이 보내 준 목록에서 휴대폰 글꼴로도 잘 보이는 짧은 것만 골랐다
// (보이지 않는 글자·아랍 결합 문자·긴 구분선은 뺌). 위기·폭력·안전 안내 문장에는 붙이지 않는다(app/api/chat · lib/rag/prompt.ts).
// 클라이언트도 쓰므로 "server-only"를 넣지 않는다.

// 2026-11-27 대표님: 얼굴 이모티콘도 — 보내 준 얼굴 중 마크다운 기호(*, `)가 없는 4개(답변에 마크다운 기호를 쓰지 않는 규칙과 부딪히지 않게).
export const SPARKLES = [
  "₊˚⊹⋆", "⋆˙⟡", "⋆⭒˚.⋆", "˙⋆✮", "₊˚⊹☆", "˚.⋆⁺₊", "⋆✴︎˚｡⋆", "｡.✩ ⊹ 。",
  "✩‧₊˚⸜('꒳ ')ଓ ༘˚˖", "ଘ(∩^o^)⊃━☆゜", "ଘ(´•3•)⊃━☆", "ᜊ(੭ ˊ ᵕˋ)੭ : ﾟ.+",
] as const;

export function pickSparkle(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SPARKLES[h % SPARKLES.length];
}

// 인사 첫 문단 끝에 별가루 하나(이미 있으면 그대로)
export function withSparkle(text: string, sparkle: string): string {
  if (!text || SPARKLES.some((s) => text.includes(s))) return text;
  const i = text.indexOf("\n\n");
  return i < 0 ? `${text} ${sparkle}` : `${text.slice(0, i)} ${sparkle}${text.slice(i)}`;
}

// 답변 지침: 사용자가 대화를 마치려 할 때만, 마무리 인사 끝에 하나
export const FAREWELL_SPARKLE_RULE =
  `사용자가 오늘 대화를 마치려는 말(예: "고마워요", "이제 가볼게요", "잘 자요", "다음에 또 올게요")을 하면 짧게 마무리 인사를 하고, 그 마무리 인사 맨 끝에 별가루 기호 하나를 붙이세요: ${SPARKLES.join("  ")} 중 하나. ` +
  "이 기호는 마무리 인사에만 한 번 쓰고, 대화 중간의 다른 답변에는 쓰지 마세요.";
