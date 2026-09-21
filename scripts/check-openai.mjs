// OpenAI 연결 점검: 키가 유효한지, 사용할 모델이 있는지, 임베딩이 되는지 (키 값은 출력하지 않음)
import OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536차원 — DB의 knowledge_chunks.embedding vector(1536)과 일치해야 함
const CHAT_CANDIDATES = ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol", "gpt-6-astra"];

if (!process.env.OPENAI_API_KEY) {
  console.log("❌ OPENAI_API_KEY가 .env.local에 없습니다.");
  process.exit(1);
}
const client = new OpenAI();
let failed = 0;
const check = (c, name, d = "") => { console.log(`  ${c ? "✅" : "❌"} ${name}${!c && d ? " — " + d : ""}`); if (!c) failed++; };

console.log("\n[1] 사용 가능한 모델");
let ids = [];
try {
  const list = await client.models.list();
  ids = list.data.map((m) => m.id);
  check(true, `키 정상 (모델 ${ids.length}개 조회됨)`);
} catch (e) {
  check(false, "키로 모델 목록 조회", `${e.status ?? ""} ${e.message}`);
  process.exit(1);
}
check(ids.includes(EMBEDDING_MODEL), `임베딩 모델 ${EMBEDDING_MODEL}`);
for (const m of CHAT_CANDIDATES) console.log(`  ${ids.includes(m) ? "✅" : "➖"} 채팅 모델 ${m} ${ids.includes(m) ? "사용 가능" : "이 키에서는 안 보임"}`);
console.log("  (참고) gpt 계열 전체:", ids.filter((i) => /^gpt-/.test(i)).sort().slice(0, 40).join(", "));

console.log("\n[2] 임베딩 1회 시험");
try {
  const r = await client.embeddings.create({ model: EMBEDDING_MODEL, input: "연결 시험", encoding_format: "float" });
  check(r.data[0].embedding.length === 1536, `임베딩 차원 1536 (실제 ${r.data[0].embedding.length})`);
  console.log(`     사용 토큰: ${r.usage.total_tokens}`);
} catch (e) {
  check(false, "임베딩 호출", `${e.status ?? ""} ${e.message}`);
}
console.log(failed ? `\n실패 ${failed}건\n` : "\n모두 통과했습니다.\n");
process.exit(failed ? 1 : 0);
