// 이론 라이브러리 JSON(scripts/theory_library_to_json.py가 만든 것)을 DB에 넣는다.
// 순서: 이론 → 개념 → 기법 → 질문 → 판별 문장(+임베딩) → 이론 기반 실천 → 실천 조건 → 기존 실천 연결 → 매칭 테스트 문장.
// 모두 upsert(같은 ID면 덮어씀)라 여러 번 실행해도 안전하다. 기존 575개 실천(origin ≠ THEORY_KB)은 절대 건드리지 않는다.
//
// 사용법:
//   node --env-file=.env.local scripts/import_theory_library.mjs <json> --reviewer "쏠 운영 회의" --reviewed-at 2026-10-06 [--dry-run] [--skip-practices | --only-practices]
//   --skip-practices: 이론 데이터만(이론·개념·기법·질문·판별 문장·연결·테스트 문장). 실천 342개는 넣지 않는다.
//   --only-practices: 이론 기반 실천(+조건표)만 넣는다. 실천은 넣는 즉시 홈·채팅 추천 후보가 되므로, 노출 제한 코드가
//                     배포된 것을 확인한 뒤에 실행한다.
//
// --reviewer/--reviewed-at은 필수다: 가져오는 모든 줄을 "검수 완료(APPROVED)"로 기록하는 것이라, 누가 언제 검수했는지
// 반드시 함께 남긴다(문서 4-10 운영 원칙). --dry-run이면 DB에 아무것도 쓰지 않고 검증만 한다.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const args = process.argv.slice(2);
const jsonPath = args.find((a) => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--"));
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const dryRun = args.includes("--dry-run");
const skipPractices = args.includes("--skip-practices"), onlyPractices = args.includes("--only-practices");
if (skipPractices && onlyPractices) { console.error("--skip-practices와 --only-practices는 같이 쓸 수 없습니다."); process.exit(1); }
const reviewer = opt("--reviewer"), reviewedAt = opt("--reviewed-at");
if (!jsonPath || !reviewer || !reviewedAt) {
  console.error('사용법: node --env-file=.env.local scripts/import_theory_library.mjs <json> --reviewer "쏠 운영 회의" --reviewed-at 2026-10-06 [--dry-run]');
  process.exit(1);
}
const EMBEDDING_MODEL = "text-embedding-3-small";
const D = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const stamp = { review_status: "APPROVED", reviewed_by: reviewer, reviewed_at: new Date(reviewedAt + "T00:00:00+09:00").toISOString() };
const REVIEW_NOTE = `이론 라이브러리 검수 완료 — ${reviewer} ${reviewedAt}`;

function fail(msg) { console.error("❌ " + msg); process.exit(1); }
function chunks(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }
async function upsert(table, rows, onConflict) {
  for (const part of chunks(rows, 100)) {
    const { error } = await admin.from(table).upsert(part, { onConflict });
    if (error) fail(`${table} 저장 실패: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length}행 저장`);
}

// ---- 검증 --------------------------------------------------------------------------------------
const theoryIds = new Set(D.theories.map((t) => t.theory_id));
const conceptIds = new Set(D.concepts.map((c) => c.concept_id));
const techniqueIds = new Set(D.techniques.map((t) => t.technique_id));
const practiceIds = D.practices.map((p) => p.id);
if (D.theories.length !== theoryIds.size) fail("이론 ID 중복");
if (practiceIds.length !== new Set(practiceIds).size) fail("실천 ID 중복");
for (const c of D.concepts) if (!theoryIds.has(c.theory_id)) fail(`개념 ${c.concept_id}의 이론 ${c.theory_id}가 없음`);
for (const t of D.techniques) if (!theoryIds.has(t.theory_id)) fail(`기법 ${t.technique_id}의 이론이 없음`);
for (const q of D.questions) {
  if (!theoryIds.has(q.theory_id)) fail(`질문 ${q.question_id}의 이론이 없음`);
  if (q.concept_id && !conceptIds.has(q.concept_id)) fail(`질문 ${q.question_id}의 개념 ${q.concept_id}가 없음`);
  if (q.technique_id && !techniqueIds.has(q.technique_id)) fail(`질문 ${q.question_id}의 기법 ${q.technique_id}가 없음`);
}
for (const s of D.signals) if (!theoryIds.has(s.theory_id)) fail(`판별 문장 ${s.signal_id}의 이론이 없음`);
for (const p of D.practices) {
  if (!theoryIds.has(p.source_theory_id)) fail(`실천 ${p.id}의 이론이 없음`);
  if (p.concept_id && !conceptIds.has(p.concept_id)) fail(`실천 ${p.id}의 개념이 없음`);
  if (p.exposure_flag && !p.exposure_step) fail(`실천 ${p.id}: exposure인데 단계가 없음`);
  if (!p.title || !p.detail) fail(`실천 ${p.id}: 제목/설명 비어 있음`);
  // 필요 조건 안전 점검(2026-10-06 owner 승인): 육아 영역은 돌봄 필요, 연애 영역은 파트너 필요(혼자 가능한 예외는 시트에서 확정)
  if (p.domain === "육아" && !p.requires_childcare) fail(`실천 ${p.id}: 육아 영역인데 돌봄필요 아님`);
}
const { data: existing, error: exErr } = await admin.from("wellness_practices").select("id, origin").in("id", practiceIds);
if (exErr) fail("wellness_practices 조회 실패: " + exErr.message);
const clash = (existing ?? []).filter((r) => r.origin !== "THEORY_KB");
if (clash.length) fail(`기존 실천과 ID가 겹칩니다(덮어쓰지 않음): ${clash.slice(0, 5).map((r) => r.id).join(", ")}`);
const { error: schemaErr } = await admin.from("counseling_theories").select("theory_id").limit(1);
if (schemaErr) {
  const msg = "counseling_theories 테이블이 없습니다. 먼저 20261006000200_theory_library_schema.sql을 실행해 주세요. (" + schemaErr.message + ")";
  if (dryRun) console.warn("⚠ " + msg); else fail(msg);
}
console.log("검증 통과:", { 이론: D.theories.length, 개념: D.concepts.length, 기법: D.techniques.length, 질문: D.questions.length, 판별문장: D.signals.length, 실천: D.practices.length, 연결: D.links.length, 테스트문장: D.eval.length });
if (dryRun) { console.log("--dry-run: DB에 쓰지 않고 끝냅니다."); process.exit(0); }

// ---- 저장 --------------------------------------------------------------------------------------
console.log("저장 시작 (검수자:", reviewer, reviewedAt + ")");
if (!onlyPractices) {
await upsert("counseling_theories", D.theories.map((t) => ({ ...t, ...stamp })), "theory_id");
await upsert("theory_concepts", D.concepts.map((c) => ({ ...c, ...stamp })), "concept_id");
await upsert("theory_techniques", D.techniques.map((t) => ({ ...t, ...stamp })), "technique_id");
await upsert("theory_questions", D.questions.map((q) => ({ ...q, ...stamp })), "question_id");

// 판별 문장: 임베딩을 만들어 함께 저장(문장당 몇십 토큰 — 비용은 사실상 0원)
const openai = new OpenAI();
const embeddings = [];
for (const part of chunks(D.signals, 100)) {
  const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: part.map((s) => s.utterance), encoding_format: "float" });
  embeddings.push(...res.data.map((d) => d.embedding));
}

await upsert("theory_signals", D.signals.map((s, i) => ({ ...s, embedding: JSON.stringify(embeddings[i]), ...stamp })), "signal_id");
}

// 이론 기반 실천(+ 조건표)
if (!skipPractices) {
const origin = "THEORY_KB";
await upsert("wellness_practices", D.practices.map((p) => ({
  id: p.id, domain: p.domain, category: p.category, tier: p.tier, title: p.title, detail: p.detail, origin,
  secondary_domains: p.secondary_domains, availability: p.availability, exposure_flag: p.exposure_flag, exposure_step: p.exposure_step,
  coping_fit: p.coping_fit, concept_id: p.concept_id, suggest_reason: p.suggest_reason, source_theory_id: p.source_theory_id, source_technique: p.source_technique,
})), "id");
await upsert("practice_eligibility", D.practices.map((p) => ({
  practice_id: p.id, audience_mode: p.audience_mode, requires_partner: p.requires_partner, requires_childcare: p.requires_childcare,
  requires_work: p.requires_work, requires_other_person: false, work_context: "none", allowed_primary_activity: [],
  q4_value_codes: p.q4, q5_hobby_codes: p.q5, q6_weekend_codes: p.q6, q7_focus_codes: p.q7, q9_exclusion_codes: p.q9,
  estimated_min_minutes: p.min_minutes, estimated_max_minutes: p.max_minutes, time_evidence: "editorial_estimate_not_user_tested",
  safety_tags: p.exposure_flag ? ["theory_kb", `exposure_step_${p.exposure_step}`] : ["theory_kb"],
  review_status: "APPROVED", review_note: REVIEW_NOTE, reviewed_by: reviewer, reviewed_at: stamp.reviewed_at,
})), "practice_id");
}

// 연결(이 이론들의 기존 연결을 지우고 다시 넣는다 — 같은 파일을 다시 가져와도 중복되지 않게)
if (!onlyPractices) {
  const ids = [...theoryIds];
  const { error } = await admin.from("theory_practice_links").delete().in("theory_id", ids);
  if (error) fail("연결 삭제 실패: " + error.message);
  for (const part of chunks(D.links, 100)) {
    const { error: e2 } = await admin.from("theory_practice_links").insert(part.map((l) => ({ ...l, review_status: "APPROVED" })));
    if (e2) fail("연결 저장 실패: " + e2.message);
  }
  console.log(`  theory_practice_links: ${D.links.length}행 저장`);
}
if (!onlyPractices) await upsert("matching_eval_set", D.eval, "eval_id");
console.log("✅ 완료");
