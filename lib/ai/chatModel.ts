import "server-only";
import OpenAI from "openai";

// SSOL 답변 생성 모델을 부르는 유일한 곳. 다른 회사 AI로 바꾸거나 모델을 올릴 때 여기만 고치면 된다.
// 분류기(lib/safety/classify.ts)는 별도 env(SAFETY_CLASSIFIER_MODEL)로 독립적으로 조정한다.
const MODEL = process.env.CHAT_MODEL || "gpt-5.6-luna";

export type ChatUsage = { inputTokens: number; outputTokens: number; model: string };

export async function generateReply(
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<{ text: string; usage: ChatUsage }> {
  const client = new OpenAI({ timeout: 20000, maxRetries: 1 });
  const response = await client.responses.create({
    model: MODEL,
    input: [{ role: "system", content: system }, ...messages],
    // 답변을 300~500자로 짧게 두라는 프롬프트 지시를 넘기는 경우가 있어(체감 대기시간에 영향),
    // 토큰 상한을 걸어둔다. 한국어는 토큰당 글자 수가 낮은 편이라 여유 있게 잡았다.
    max_output_tokens: 500,
  });

  const text = response.output_text?.trim();
  if (!text) throw new Error("답변 생성 모델이 빈 응답을 반환함");

  return {
    text,
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      model: MODEL,
    },
  };
}
