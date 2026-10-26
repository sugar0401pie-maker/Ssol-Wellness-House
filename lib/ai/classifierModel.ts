import "server-only";
import OpenAI from "openai";

// 발화 의미 분류기(lib/interp) 전용 AI 호출 — 답변 뒤에 백그라운드로 도는 작업이라 시간 여유를 조금 더 둔다.
// 모든 AI 호출은 lib/ai/ 안에서만 한다(제공사 교체를 쉽게). 모델은 SW_CLASSIFIER_MODEL → THEORY_SELECT_MODEL → CHAT_MODEL → gpt-5.6-luna 순.
const MODEL = process.env.SW_CLASSIFIER_MODEL || process.env.THEORY_SELECT_MODEL || process.env.CHAT_MODEL || "gpt-5.6-luna";
const REASONING = process.env.SW_CLASSIFIER_REASONING || "low";

export const CLASSIFIER_MODEL_NAME = MODEL;

export async function callClassifierModel(p: { system: string; user: string }): Promise<string> {
  const client = new OpenAI({ timeout: 25000, maxRetries: 0 });
  const response = await client.responses.create({
    model: MODEL,
    input: [{ role: "system", content: p.system }, { role: "user", content: p.user }],
    max_output_tokens: 900, // 추론 모델은 답 전에 생각에도 토큰을 쓴다 — 너무 작으면 답이 비어 돌아온다
    text: { format: { type: "json_object" } },
    ...(REASONING !== "default" ? { reasoning: { effort: REASONING as "minimal" | "low" | "medium" | "high" } } : {}),
  });
  return (response.output_text ?? "").trim();
}
