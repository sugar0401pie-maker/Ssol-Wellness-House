import "server-only";
import OpenAI from "openai";
import { recordUsage } from "./usage";

// 관리자 이용 보고서용 긴 글 생성. AI 제공사 호출은 lib/ai 안에서만 한다는 규칙에 따라 여기에 둔다(채팅 모델과 별개 파일 — 출력 길이·대기 시간이 다르다).
// 모델은 ADMIN_REPORT_MODEL로 바꿀 수 있고, 없으면 채팅 모델(CHAT_MODEL)을 그대로 쓴다.
const MODEL = process.env.ADMIN_REPORT_MODEL || process.env.CHAT_MODEL || "gpt-5.6-luna";

export async function generateLongText(system: string, user: string, maxOutputTokens = 4000): Promise<string> {
  const client = new OpenAI({ timeout: 110_000, maxRetries: 1 });
  const response = await client.responses.create({
    model: MODEL,
    input: [{ role: "system", content: system }, { role: "user", content: user }],
    max_output_tokens: maxOutputTokens,
  });
  recordUsage({ feature: "admin_report", model: MODEL, inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0, cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0 });
  const text = response.output_text?.trim();
  if (!text) throw new Error("보고서 생성 모델이 빈 응답을 반환함");
  return text;
}
