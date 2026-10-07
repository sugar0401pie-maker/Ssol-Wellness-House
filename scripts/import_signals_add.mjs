// 판별 예시 문장 추가본(scripts/signals_add_to_json.py가 만든 JSON)을 theory_signals에 넣는다(+임베딩). 새 문장만 추가하고 기존 문장은 절대 덮어쓰지 않는다.
//   node --env-file=.env.local scripts/import_signals_add.mjs <json> --reviewer "쏠 운영(owner 확인)" --reviewed-at 2026-10-07 [--dry-run]
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const jsonPath = args[0], reviewer = opt("--reviewer"), reviewedAt = opt("--reviewed-at"), dryRun = args.includes("--dry-run");
if (!jsonPath || !reviewer || !reviewedAt) { console.error("사용법: <json> --reviewer ... --reviewed-at YYYY-MM-DD [--dry-run]"); process.exit(1); }
const D = JSON.parse(fs.readFileSync(jsonPath, "utf-8")).signals;
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const [{ data: theories }, { data: existing }] = await Promise.all([admin.from("counseling_theories").select("theory_id"), admin.from("theory_signals").select("signal_id, utterance")]);
const tIds = new Set(theories.map((t) => t.theory_id)), exIds = new Set(existing.map((e) => e.signal_id)), exText = new Set(existing.map((e) => e.utterance));
const problems = [];
for (const s of D) {
  if (!tIds.has(s.theory_id)) problems.push(`${s.signal_id}: 이론 없음 ${s.theory_id}`);
  if (exIds.has(s.signal_id)) problems.push(`${s.signal_id}: 이미 있는 ID(덮어쓰지 않음)`);
  if (exText.has(s.utterance)) problems.push(`${s.signal_id}: 기존과 같은 문장`);
  if (!s.utterance) problems.push(`${s.signal_id}: 문장이 비어 있음`);
  if (!["가능", "검토", "불가"].includes(s.reflection_ok)) problems.push(`${s.signal_id}: reflection_ok 값 이상 "${s.reflection_ok}"`);
}
if (new Set(D.map((s) => s.signal_id)).size !== D.length) problems.push("파일 안에 중복 ID");
console.log(`문장 ${D.length}개, 기존 ${existing.length}개, 문제 ${problems.length}개`);
if (problems.length) { console.log(problems.join("\n")); process.exit(1); }
if (dryRun) { console.log("--dry-run: DB에 쓰지 않았습니다."); process.exit(0); }

const openai = new OpenAI();
const emb = [];
for (let i = 0; i < D.length; i += 100) {
  const part = D.slice(i, i + 100);
  const res = await openai.embeddings.create({ model: "text-embedding-3-small", input: part.map((s) => s.utterance), encoding_format: "float" });
  emb.push(...res.data.map((d) => d.embedding));
}
const stamp = { review_status: "APPROVED", reviewed_by: reviewer, reviewed_at: new Date(reviewedAt + "T00:00:00+09:00").toISOString() };
const rows = D.map((s, i) => ({ ...s, embedding: JSON.stringify(emb[i]), ...stamp }));
for (let i = 0; i < rows.length; i += 50) {
  const { error } = await admin.from("theory_signals").insert(rows.slice(i, i + 50)); // upsert가 아니라 insert — 같은 ID가 있으면 실패해서 기존 행을 지킨다
  if (error) { console.error("저장 실패:", error.message); process.exit(1); }
}
const { count } = await admin.from("theory_signals").select("*", { count: "exact", head: true });
console.log("저장 완료. theory_signals 총", count, "개");
