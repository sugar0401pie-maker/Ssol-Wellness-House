import "server-only";
import OpenAI from "openai";

// 추론 모델은 답을 쓰기 전에 생각에도 출력 토큰을 쓴다. 한도가 40이면 답이 비어 돌아온다(2026-10-07 검증에서 확인).
// 짧은 분류·판단용 AI 호출(이론 고르기 등). 답변 생성 모델(chatModel.ts)과 별개로 THEORY_SELECT_MODEL로 바꿀 수 있고,
// 없으면 같은 모델(CHAT_MODEL, 기본 gpt-5.6-luna)을 쓴다. 모든 AI 호출은 lib/ai/ 안에서만 한다(제공사 교체를 쉽게).
const MODEL = process.env.THEORY_SELECT_MODEL || process.env.CHAT_MODEL || "gpt-5.6-luna";

export type ShortUsage = { inputTokens: number; outputTokens: number; model: string };

export async function generateShort(system: string, user: string, maxOutputTokens = 300): Promise<{ text: string; usage: ShortUsage }> {
  const client = new OpenAI({ timeout: 12000, maxRetries: 1 });
  const response = await client.responses.create({
    model: MODEL,
    input: [{ role: "system", content: system }, { role: "user", content: user }],
    max_output_tokens: maxOutputTokens,
  });
  return {
    text: (response.output_text ?? "").trim(),
    usage: { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0, model: MODEL },
  };
}
