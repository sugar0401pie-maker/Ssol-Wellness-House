// 상담사 검토(2026-10-07 요청, 2026-10-19 반영)의 DB 반영: 공감 문장 48개(theory_signals)와 평가 정답(matching_eval_set).
//   node --env-file=.env.local scripts/apply_counselor_review.mjs <review.json> [--dry-run]
// review.json = { empathy: [{id, judgment, revised, note}], eval: [{id, label, why}] } — 상담사 엑셀에서 뽑은 것(저장소 밖).
// 안전: 수정 문구는 먼저 출력 검수(checkOutput)를 통과해야 하며 하나라도 걸리면 아무것도 쓰지 않고 중단한다.
// 되돌릴 수 있게 원래 값은 memo / check_point 끝에 남긴다. 같은 표시가 이미 있으면 건너뛰어 여러 번 실행해도 안전하다.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { checkOutput } from "../lib/safety/outputCheck.ts";

const R = JSON.parse(fs.readFileSync(process.argv[2], "utf-8")), dry = process.argv.includes("--dry-run");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const MARK = "[상담사 검토 2026-10-07]";
const OK = { "사용 가능": "가능", "수정 후 사용": "가능", "사용 안 함": "불가" };

// 1) 수정 문구 사전 검수
const failed = R.empathy.filter((e) => e.judgment === "수정 후 사용").filter((e) => !checkOutput(e.revised, { usedClinicalChunk: false, clinicalBoundaryAlreadyStated: true }).ok);
if (failed.length) { console.error("출력 검수에 걸린 수정 문구 — 중단:", failed.map((e) => e.id).join(", ")); process.exit(1); }
const unknown = R.empathy.filter((e) => !OK[e.judgment]);
if (unknown.length) { console.error("판단 값이 이상한 행 — 중단:", unknown.map((e) => `${e.id}:${e.judgment}`).join(", ")); process.exit(1); }

// 2) 공감 문장
const { data: sig, error: se } = await admin.from("theory_signals").select("signal_id,reflection_text,reflection_ok,memo").in("signal_id", R.empathy.map((e) => e.id));
if (se) { console.error(se.message); process.exit(1); }
const byId = new Map(sig.map((s) => [s.signal_id, s]));
let n = 0, skip = 0; const missing = [];
for (const e of R.empathy) {
  const cur = byId.get(e.id);
  if (!cur) { missing.push(e.id); continue; }
  if ((cur.memo ?? "").includes(MARK)) { skip++; continue; }
  const note = `${MARK} ${e.judgment}${e.judgment === "수정 후 사용" ? ` / 원문: ${cur.reflection_text}` : ""}${e.note ? ` / 상담사 비고: ${e.note.replace(/\s+/g, " ").slice(0, 200)}` : ""}`;
  const patch = { reflection_ok: OK[e.judgment], memo: cur.memo ? `${cur.memo} | ${note}` : note, ...(e.judgment === "수정 후 사용" ? { reflection_text: e.revised } : {}), updated_at: new Date().toISOString() };
  if (!dry) { const { error } = await admin.from("theory_signals").update(patch).eq("signal_id", e.id); if (error) { console.error(e.id, error.message); process.exit(1); } }
  n++;
}
console.log(`공감 문장 ${dry ? "(모의) " : ""}반영 ${n}건 · 이미 반영 ${skip}건 · DB에 없음 ${missing.length ? missing.join(",") : "없음"}`);

// 3) 평가 정답
const { data: ev } = await admin.from("matching_eval_set").select("eval_id,expected_label,check_point").in("eval_id", R.eval.map((e) => e.id));
const evById = new Map(ev.map((r) => [r.eval_id, r]));
let m = 0, mskip = 0;
for (const u of R.eval) {
  const row = evById.get(u.id); if (!row) { console.error("평가 문장 없음:", u.id); continue; }
  if ((row.check_point ?? "").includes(MARK)) { mskip++; continue; }
  const check_point = `${row.check_point ?? ""}${row.check_point ? " | " : ""}${MARK} 원래 정답: ${row.expected_label} / 이유: ${u.why}`;
  if (!dry) { const { error } = await admin.from("matching_eval_set").update({ expected_label: u.label, check_point }).eq("eval_id", u.id); if (error) { console.error(u.id, error.message); process.exit(1); } }
  m++;
}
console.log(`평가 정답 ${dry ? "(모의) " : ""}갱신 ${m}건 · 이미 반영 ${mskip}건`);
