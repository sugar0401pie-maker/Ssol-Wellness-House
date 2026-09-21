// knowledge_chunks의 검색용 임베딩(의미 지문) 생성 — 일회성, 재실행 가능
// 실행: npm run embed:chunks           (임베딩이 비어 있는 chunk만 채움)
//       npm run embed:chunks -- --all  (전부 다시 생성)
// 비용: chunk 약 82개 × 200토큰 안팎 → 1원 미만. 키 값은 출력하지 않습니다.
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536차원 (DB 컬럼과 일치해야 함)
const redoAll = process.argv.includes("--all");

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const openai = new OpenAI();

// 임베딩 대상 텍스트: 제목 + 본문 + "언제 쓰는지(use_when)" + 주제 태그.
// (본문만 쓰는 것보다 실험에서 검색 정확도가 높았음: 2026-09-21. 원래 설정 article_embedding_source=chunk_text에서 변경)
const embeddingText = (c) =>
  `${c.chunk_title}\n${c.chunk_text}\n이럴 때: ${c.use_when ?? ""}\n주제: ${(c.issue_tags ?? []).join(", ")}`;

let query = admin.from("knowledge_chunks").select("chunk_id, chunk_title, chunk_text, use_when, issue_tags").order("chunk_id");
if (!redoAll) query = query.is("embedding", null);
const { data: rows, error } = await query;
if (error) { console.error("chunk 조회 실패:", error.message); process.exit(1); }
if (!rows.length) { console.log("임베딩이 필요한 chunk가 없습니다 (이미 모두 생성됨)."); process.exit(0); }

console.log(`임베딩 생성 대상: ${rows.length}개 (${EMBEDDING_MODEL})`);
let tokens = 0, done = 0;
for (let i = 0; i < rows.length; i += 32) {
  const batch = rows.slice(i, i + 32);
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: batch.map(embeddingText),
    encoding_format: "float",
  });
  tokens += res.usage.total_tokens;
  for (let j = 0; j < batch.length; j++) {
    const vec = res.data[j].embedding;
    if (vec.length !== 1536) { console.error(`차원 오류: ${batch[j].chunk_id} (${vec.length})`); process.exit(1); }
    const { error: upErr } = await admin.from("knowledge_chunks").update({ embedding: vec }).eq("chunk_id", batch[j].chunk_id);
    if (upErr) { console.error(`저장 실패 ${batch[j].chunk_id}:`, upErr.message); process.exit(1); }
    done++;
  }
  console.log(`  ${done}/${rows.length} 저장`);
}
console.log(`\n완료. 사용 토큰 ${tokens}개.`);
const { count } = await admin.from("knowledge_chunks").select("*", { count: "exact", head: true }).is("embedding", null);
console.log(`임베딩이 아직 비어 있는 chunk: ${count ?? "?"}개`);
