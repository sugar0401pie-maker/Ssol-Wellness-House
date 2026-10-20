// 실천 DB 정리안 v0.4(CSO) 중 "확정된 정의 + 제외 코드 + 온보딩 코드 빈칸"을 practice_eligibility에 반영한다(2026-10-20).
//   node --env-file=.env.local scripts/apply_practice_cleanup.mjs <cleanup.json> [--dry-run] [--backup <백업.json>]
//   node --env-file=.env.local scripts/apply_practice_cleanup.mjs --rollback <백업.json>          # 되돌리기
// 반영하는 것: ① 다른 사람 필요(좁은 정의, CSO 확정) → requires_other_person ② 제외 코드(Q9) 추가·삭제 ③ Q5·Q6 소프트 매칭 코드 추가(합집합)
// 반영하지 않는 것: 카테고리 이름 변경·잘못 분류(검수 전 AI 초안, 기존 카테고리 문자열에 기대는 코드가 있음), 신규 실천 후보 54개(승인·자동 노출 금지), 운영에 아직 없는 신규 이론 실천 107개.
// 안전: 시트의 "현재" 값이 지금 DB 값과 다르면(그 사이 누가 고쳤을 수 있음) 그 행은 건너뛰고 보고한다. 바꾼 행의 이전 값은 백업 파일에 남겨 되돌릴 수 있다.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2), flag = (n) => args.includes(n), opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const MARK = "[실천 정리안 v0.4 2026-10-20]";
const eq = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

if (opt("--rollback")) {
  const b = JSON.parse(fs.readFileSync(opt("--rollback"), "utf8"));
  for (const r of b.rows) {
    const { error } = await admin.from("practice_eligibility").update({ requires_other_person: r.requires_other_person, q9_exclusion_codes: r.q9_exclusion_codes, q5_hobby_codes: r.q5_hobby_codes, q6_weekend_codes: r.q6_weekend_codes, review_note: r.review_note, updated_at: new Date().toISOString() }).eq("practice_id", r.practice_id);
    if (error) { console.error(r.practice_id, error.message); process.exit(1); }
  }
  console.log(`되돌림 ${b.rows.length}행`); process.exit(0);
}

const C = JSON.parse(fs.readFileSync(args.find((a) => a.endsWith(".json") && !a.startsWith("--")), "utf8")), dry = flag("--dry-run");
const cur = new Map(); for (let f = 0; ; f += 1000) { const { data, error } = await admin.from("practice_eligibility").select("*").range(f, f + 999); if (error) throw error; data.forEach((r) => cur.set(r.practice_id, r)); if (data.length < 1000) break; }
const plan = new Map(); const rep = { 없음: [], 불일치: [], q9: 0, op: 0, q5q6: 0 };
const upd = (id) => { if (!plan.has(id)) { const r = cur.get(id); plan.set(id, { before: { practice_id: id, requires_other_person: r.requires_other_person, q9_exclusion_codes: r.q9_exclusion_codes, q5_hobby_codes: r.q5_hobby_codes, q6_weekend_codes: r.q6_weekend_codes, review_note: r.review_note }, patch: {}, notes: [] }); } return plan.get(id); };

for (const o of C.other_people) {
  const r = cur.get(o.id); if (!r) { rep.없음.push(o.id); continue; }
  const want = o.to === "예", was = o.from === "예";
  if (r.requires_other_person !== was) { rep.불일치.push(`${o.id}(다른 사람 필요: DB ${r.requires_other_person} ≠ 시트 ${was})`); continue; }
  if (want === r.requires_other_person) continue;
  const u = upd(o.id); u.patch.requires_other_person = want; u.notes.push(`다른 사람 필요 ${was ? "예" : "아니오"}→${want ? "예" : "아니오"}`); rep.op++;
}
for (const q of C.q9) {
  const r = cur.get(q.id); if (!r) { rep.없음.push(q.id); continue; }
  if (!eq(r.q9_exclusion_codes ?? [], q.from)) { rep.불일치.push(`${q.id}(Q9: DB [${r.q9_exclusion_codes}] ≠ 시트 [${q.from}])`); continue; }
  if (eq(q.from, q.to)) continue;
  const u = upd(q.id); u.patch.q9_exclusion_codes = q.to; u.notes.push(`Q9 ${q.change.trim()}`); rep.q9++;
}
for (const q of C.q5q6) {
  const r = cur.get(q.id); if (!r) { rep.없음.push(q.id); continue; }
  const n5 = [...new Set([...(r.q5_hobby_codes ?? []), ...q.q5])], n6 = [...new Set([...(r.q6_weekend_codes ?? []), ...q.q6])];
  if (eq(n5, r.q5_hobby_codes ?? []) && eq(n6, r.q6_weekend_codes ?? [])) continue;
  const u = upd(q.id); if (!eq(n5, r.q5_hobby_codes ?? [])) u.patch.q5_hobby_codes = n5; if (!eq(n6, r.q6_weekend_codes ?? [])) u.patch.q6_weekend_codes = n6; u.notes.push("Q5·Q6 코드 추가"); rep.q5q6++;
}
const uniq = (xs) => [...new Set(xs.map((x) => x.split("(")[0]))];
console.log(`반영 대상 ${plan.size}행 (다른 사람 필요 ${rep.op} · 제외 코드 ${rep.q9} · Q5/Q6 ${rep.q5q6}) · DB에 없는 실천 ${uniq(rep.없음).length}개(신규 이론 6개 실천 등, 건너뜀) · 현재 값이 달라 건너뜀 ${rep.불일치.length}행`);
rep.불일치.slice(0, 8).forEach((x) => console.log("  건너뜀:", x));
if (dry) process.exit(0);
const backup = opt("--backup") ?? `practice_eligibility_backup_${Date.now()}.json`;
fs.writeFileSync(backup, JSON.stringify({ at: new Date().toISOString(), rows: [...plan.values()].map((p) => p.before) }, null, 1));
let n = 0;
for (const [id, p] of plan) {
  const note = `${MARK} ${p.notes.join(" · ")}`;
  const { error } = await admin.from("practice_eligibility").update({ ...p.patch, review_note: p.before.review_note ? `${p.before.review_note} | ${note}` : note, updated_at: new Date().toISOString() }).eq("practice_id", id);
  if (error) { console.error(id, error.message, "— 백업:", backup); process.exit(1); }
  n++;
}
console.log(`반영 ${n}행 · 백업 ${backup}`);
