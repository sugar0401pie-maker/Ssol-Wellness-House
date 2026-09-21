// 지식 검색 시험: 질문을 임베딩해서 가장 가까운 chunk를 보여줍니다. (채팅 기능과 무관, 읽기 전용)
// 실행: npm run search:test            (기본 시나리오)
//       npm run search:test -- "직접 넣을 질문"
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const EMBEDDING_MODEL = "text-embedding-3-small";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const openai = new OpenAI();

const custom = process.argv.slice(2).filter((a) => !a.startsWith("--")).join(" ").trim();
// [질문, scope, 기대하는 글(article) 접두어]
const scenarios = custom
  ? [[custom, "general", null]]
  : [
      ["별 문제는 없는데 요즘 공허하고 행복하지 않아요", "general", "SSOL-HAP"],
      ["남자친구랑 자주 싸워요. 헤어져야 할까요?", "general", "SSOL-ROM"],
      ["완벽하게 못 할 것 같아서 시작을 못 하겠어요", "general", "SSOL-SELF"],
      ["퇴사할지 계속 다닐지 모르겠어요", "general", null],
      ["우울한 기분이 몇 주째 계속돼요", "clinical", "SSOL-DEP"],
      ["집중이 안 되는데 ADHD일까요?", "clinical", "SSOL-ADHD"],
      ["갑자기 숨이 막히고 심장이 뛰어요", "clinical", "SSOL-PANIC"],
      ["점심 메뉴 추천해줘", "general", null], // 관련 없는 질문: 유사도가 낮아야 함
    ];

let hit = 0, expectCount = 0;
for (const [q, scope, expect] of scenarios) {
  const emb = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: q, encoding_format: "float" });
  const { data, error } = await admin.rpc("match_knowledge_chunks", {
    query_embedding: emb.data[0].embedding, match_count: 3, min_similarity: 0, scope,
  });
  console.log(`\n질문: "${q}"  [scope=${scope}]`);
  if (error) { console.log("  ❌ 검색 오류:", error.message); continue; }
  if (!data.length) console.log("  (결과 없음 — 임베딩이 아직 없거나 비활성)");
  for (const r of data) {
    console.log(`  ${r.similarity.toFixed(3)}  ${r.chunk_id.padEnd(11)} ${r.chunk_title}  [${r.evidence_level}${r.clinical_sensitive ? ", 임상" : ""}]`);
  }
  if (expect) {
    expectCount++;
    const ok = data.some((r) => r.article_id.startsWith(expect));
    if (ok) hit++;
    console.log(`  ${ok ? "✅" : "⚠️"} 기대한 글(${expect}…)이 상위 3개 안에 ${ok ? "있음" : "없음"}`);
  }
}
if (expectCount) console.log(`\n기대 글 적중: ${hit}/${expectCount}`);
