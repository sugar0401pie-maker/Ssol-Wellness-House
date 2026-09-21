// Supabase 연결·보안 점검 (읽기 전용에 가깝고, 임시 익명 사용자 1명을 만들었다가 지웁니다).
// 실행: npm run check:supabase   (키 값은 화면에 출력하지 않습니다)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let failed = 0;
const ok = (name) => console.log(`  ✅ ${name}`);
const fail = (name, detail = "") => {
  failed++;
  console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
};
const check = (cond, name, detail) => (cond ? ok(name) : fail(name, detail));

console.log("\n[1] 환경변수 (이름만 확인, 값은 출력하지 않음)");
check(!!url, "NEXT_PUBLIC_SUPABASE_URL 입력됨");
check(!!anonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY 입력됨");
check(!!serviceKey, "SUPABASE_SERVICE_ROLE_KEY 입력됨");
if (!url || !anonKey || !serviceKey) {
  console.log("\n.env.local에 빠진 값이 있어 여기서 중단합니다.\n");
  process.exit(1);
}
if (anonKey === serviceKey) {
  fail("공개용 키와 서버 전용 키가 서로 달라야 합니다 (같은 값이 입력됨)");
  process.exit(1);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, opts);
const anon = createClient(url, anonKey, opts);

console.log("\n[2] 서버 전용 키로 지식 데이터 확인");
const expected = {
  knowledge_chunks: 82, articles: 19, safety_rules: 17, system_prompt_sections: 13,
  service_knowledge: 9, brand_knowledge: 8, programs: 5, response_routes: 7,
};
for (const [table, n] of Object.entries(expected)) {
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
  check(!error && count === n, `${table}: ${n}행`, error ? error.message : `실제 ${count}행`);
}
{
  const { count, error } = await admin
    .from("knowledge_chunks").select("*", { count: "exact", head: true }).eq("clinical_sensitive", true);
  check(!error && count === 15, "임상 chunk 표시(clinical_sensitive) 15개", error ? error.message : `실제 ${count}개`);
}

console.log("\n[3] 익명 로그인");
let userId = null;
const { data: signIn, error: signInErr } = await anon.auth.signInAnonymously();
check(!signInErr && !!signIn?.session, "익명 로그인 성공", signInErr?.message);
if (signIn?.user) userId = signIn.user.id;
if (signIn?.session) {
  const { data: who, error: whoErr } = await admin.auth.getUser(signIn.session.access_token);
  check(!whoErr && who?.user?.id === userId, "서버가 토큰으로 사용자를 확인 (채팅 API에서 사용)", whoErr?.message);
}

if (userId) {
  console.log("\n[4] 익명 사용자가 할 수 있는 것 / 없는 것 (보안)");
  const { data: prof, error: profErr } = await anon.from("profiles").select("user_id");
  check(!profErr && prof?.length === 1 && prof[0].user_id === userId, "본인 profiles 행이 자동 생성되어 있음", profErr?.message);

  const knowledgeTables = ["knowledge_chunks", "safety_rules", "system_prompt_sections", "service_knowledge", "programs"];
  for (const t of knowledgeTables) {
    const { data, error } = await anon.from(t).select("*").limit(1);
    check(!!error || (data?.length ?? 0) === 0, `브라우저 키로 ${t} 읽기 차단`, "읽혔습니다!");
  }

  const { error: sessErr } = await anon.from("chat_sessions").insert({ user_id: userId });
  check(!!sessErr, "브라우저에서 chat_sessions 직접 저장 차단 (서버만 가능)", "저장되었습니다!");

  const { error: rpcAnonErr } = await anon.rpc("match_knowledge_chunks", {
    query_embedding: Array(1536).fill(0), match_count: 1, min_similarity: 0, scope: "all",
  });
  check(!!rpcAnonErr, "브라우저에서 검색 함수 호출 차단", "호출되었습니다!");

  console.log("\n[5] 검색 함수 (서버 키)");
  const zero = Array(1536).fill(0.01);
  const { data: hits, error: rpcErr } = await admin.rpc("match_knowledge_chunks", {
    query_embedding: zero, match_count: 3, min_similarity: -1, scope: "general",
  });
  check(!rpcErr, "match_knowledge_chunks 호출 가능", rpcErr?.message);
  console.log(`     (임베딩 생성 전이라 결과 ${hits?.length ?? 0}건 — C3 이후 채워집니다)`);
  const { data: bad } = await admin.rpc("match_knowledge_chunks", {
    query_embedding: zero, match_count: 3, min_similarity: -1, scope: "unknown",
  });
  check(Array.isArray(bad) && bad.length === 0, "알 수 없는 scope는 결과 없음 (안전하게 실패)");

  // 정리: 테스트용 임시 사용자 삭제 (profiles 등은 연쇄 삭제)
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  check(!delErr, "테스트용 임시 사용자 삭제", delErr?.message);
}

console.log(failed === 0 ? "\n모두 통과했습니다.\n" : `\n실패 ${failed}건 — 위 ❌ 항목을 확인하세요.\n`);
process.exit(failed === 0 ? 0 : 1);
