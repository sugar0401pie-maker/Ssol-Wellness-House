import "server-only";
import OpenAI from "openai";

// 짧은 분류·판단용 AI 호출(이론 고르기 등). 답변 생성 모델(chatModel.ts)과 별개로 THEORY_SELECT_MODEL로 바꿀 수 있고,
// 없으면 같은 모델(CHAT_MODEL, 기본 gpt-5.6-luna)을 쓴다. 모든 AI 호출은 lib/ai/ 안에서만 한다(제공사 교체를 쉽게).
const MODEL = process.env.THEORY_SELECT_MODEL || process.env.CHAT_MODEL || "gpt-5.6-luna";

// 추론 수준을 고정한다(2026-10-07). 지정하지 않으면 모델이 어떨 때는 생각하고 어떨 때는 곧바로 답해서 같은 문장도 결과가 ±3점 흔들렸다.
// 재판정 평가에서 low가 medium과 같거나 더 좋았고(구분 단서 방식 기준 92.9% 대 90.2%) 더 빠르고 싸서 기본값을 low로 한다.
// 환경변수 THEORY_SELECT_REASONING으로 바꿀 수 있고, "default"로 두면 지정하지 않는다(이전 동작).
const REASONING = process.env.THEORY_SELECT_REASONING || "low";

export type ShortUsage = { inputTokens: number; outputTokens: number; model: string };

// 추론 모델은 답을 쓰기 전에 생각에도 출력 토큰을 쓴다. 한도가 40이면 답이 비어 돌아온다(2026-10-07 검증에서 확인).
export async function generateShort(system: string, user: string, maxOutputTokens = 300): Promise<{ text: string; usage: ShortUsage }> {
  const client = new OpenAI({ timeout: 12000, maxRetries: 1 });
  const response = await client.responses.create({
    model: MODEL,
    input: [{ role: "system", content: system }, { role: "user", content: user }],
    max_output_tokens: maxOutputTokens,
    ...(REASONING !== "default" ? { reasoning: { effort: REASONING as "minimal" | "low" | "medium" | "high" } } : {}),
  });
  return {
    text: (response.output_text ?? "").trim(),
    usage: { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0, model: MODEL },
  };
}
