import "server-only";
import OpenAI from "openai";
import { EMBEDDING_MODEL } from "@/lib/rag/retrieve";

// claim 대표 문장·발화를 한꺼번에 임베딩한다(OpenAI는 한 번에 여러 문장을 받는다). 지식 검색과 같은 모델·차원이다.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const openai = new OpenAI({ timeout: 30000, maxRetries: 1 });
  const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: texts, encoding_format: "float" });
  return res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}
