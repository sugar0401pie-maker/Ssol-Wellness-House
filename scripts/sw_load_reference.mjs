// 쏘웰라 해석 DB 참조표(sw_ob_*) CSV 적재 — 2026-10-18
// 기본은 "검사만"(네트워크 없음): CSV 머리글·형식·기본키 중복·표 사이 연결(FK)을 apply_v1.6.sql의 표 정의와 맞춰 본다.
// --apply 를 붙여야 실제로 DB에 올린다(서버 키 필요, .env.local). 이미 같은 행이 있으면 건너뛰거나 같은 키로 덮어쓰기라 여러 번 실행해도 안전하다.
//   node scripts/sw_load_reference.mjs --dir <CSV 폴더>            # 검사만
//   node scripts/sw_load_reference.mjs --dir <CSV 폴더> --apply    # 적재
// 원본 데이터(엑셀·CSV)는 저장소 밖에 둔다(CLAUDE.md: 지식 원본은 저장소 밖). 이 스크립트는 값을 출력하지 않는다.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseCsv } from "./sw_csv.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const DIR = opt("--dir");
const APPLY = flag("--apply");
const SQL = path.resolve("supabase/sw_interp/apply_v1.6.sql");
if (!DIR) { console.error("사용법: --dir <CSV 폴더> [--apply]"); process.exit(2); }

// ───── 표 정의 읽기(apply_v1.6.sql의 sw_ob_ 표) ─────
const sql = fs.readFileSync(SQL, "utf8");
const tables = {};
for (const m of sql.matchAll(/create table if not exists public\.(sw_ob_\w+) \(\n([\s\S]*?)\n\);/g)) {
  const cols = []; let pk = [];
  for (const line of m[2].split("\n")) {
    const c = line.match(/^\s{2}(\w+) (text|jsonb|integer|numeric|boolean|timestamptz|uuid|bigint)\b(.*)$/);
    if (c) cols.push({ name: c[1], type: c[2], identity: /generated always as identity/.test(c[3]), notNull: /not null/.test(c[3]) });
    const p = line.match(/primary key \(([^)]*)\)/); if (p) pk = p[1].split(",").map((s) => s.trim());
  }
  tables[m[1]] = { cols, pk, fks: [] };
}
for (const m of sql.matchAll(/alter table public\.(sw_ob_\w+) add constraint \w+ foreign key \(([^)]*)\) references public\.(sw_ob_\w+)\(([^)]*)\)/g)) {
  tables[m[1]]?.fks.push({ cols: m[2].split(",").map((s) => s.trim()), ref: m[3], refCols: m[4].split(",").map((s) => s.trim()) });
}

function convert(v, type) {
  if (v === null) return null;
  switch (type) {
    case "integer": case "bigint": { const n = Number(v); if (!Number.isInteger(n)) throw new Error(`정수 아님: ${v}`); return n; }
    case "numeric": { const n = Number(v); if (Number.isNaN(n)) throw new Error(`숫자 아님: ${v}`); return n; }
    case "boolean": { const s = String(v).toLowerCase(); if (["true", "t", "1", "yes"].includes(s)) return true; if (["false", "f", "0", "no"].includes(s)) return false; throw new Error(`불리언 아님: ${v}`); }
    case "jsonb": return JSON.parse(v);
    default: return v; // text · uuid · timestamptz
  }
}

// ───── 검사 ─────
const problems = []; const data = {};
for (const [name, t] of Object.entries(tables)) {
  const file = path.join(DIR, `${name}.csv`);
  if (!fs.existsSync(file)) { problems.push(`${name}: CSV 없음`); continue; }
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const header = rows.shift().map((h) => h.trim());
  const want = t.cols.filter((c) => !c.identity).map((c) => c.name);
  const missing = want.filter((c) => !header.includes(c)), extra = header.filter((c) => !want.includes(c));
  if (missing.length || extra.length) { problems.push(`${name}: 머리글 불일치 — 빠짐 [${missing}] 남음 [${extra}]`); continue; }
  const out = [];
  rows.forEach((r, ri) => {
    if (r.length === 1 && r[0] === null) return; // 빈 줄
    if (r.length !== header.length) { problems.push(`${name} ${ri + 2}행: 칸 수 ${r.length} ≠ ${header.length}`); return; }
    const o = {};
    header.forEach((h, k) => {
      const col = t.cols.find((c) => c.name === h);
      try { o[h] = convert(r[k], col.type); } catch (e) { problems.push(`${name} ${ri + 2}행 ${h}: ${e.message}`); }
      if (col.notNull && o[h] === null) problems.push(`${name} ${ri + 2}행 ${h}: NOT NULL인데 비어 있음`);
    });
    out.push(o);
  });
  if (t.pk.length && t.pk.every((k) => header.includes(k))) {
    const seen = new Set(); let dup = 0;
    for (const o of out) { const k = t.pk.map((c) => JSON.stringify(o[c])).join("|"); if (seen.has(k)) dup++; seen.add(k); }
    if (dup) problems.push(`${name}: 기본키 중복 ${dup}행`);
  }
  data[name] = out;
}
for (const [name, t] of Object.entries(tables)) {
  for (const fk of t.fks) {
    if (!data[name] || !data[fk.ref]) continue;
    const parent = new Set(data[fk.ref].map((o) => fk.refCols.map((c) => JSON.stringify(o[c])).join("|")));
    let bad = 0;
    for (const o of data[name]) { const vals = fk.cols.map((c) => o[c]); if (vals.some((v) => v === null)) continue; if (!parent.has(vals.map((v) => JSON.stringify(v)).join("|"))) bad++; }
    if (bad) problems.push(`${name}(${fk.cols}) → ${fk.ref}: 끊긴 연결 ${bad}행`);
  }
}
const totalRows = Object.values(data).reduce((a, b) => a + b.length, 0);
console.log(`검사: 표 ${Object.keys(tables).length}개 · CSV 읽은 표 ${Object.keys(data).length}개 · 행 ${totalRows} · 문제 ${problems.length}`);
problems.slice(0, 30).forEach((p) => console.log("  ✗", p));
if (problems.length) process.exit(1);
if (!APPLY) { console.log("검사만 했습니다(DB 변경 없음). 올리려면 --apply 를 붙이세요."); process.exit(0); }

// ───── 적재: 부모 표 먼저(자기 자신을 가리키는 연결은 같은 요청 안에서 함께 들어가므로 괜찮음) ─────
try { process.loadEnvFile(".env.local"); } catch { /* 환경 변수가 이미 있으면 됨 */ }
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const order = []; const done = new Set();
const visit = (n, stack = []) => {
  if (done.has(n)) return; if (stack.includes(n)) return;
  for (const fk of tables[n].fks) if (fk.ref !== n) visit(fk.ref, [...stack, n]);
  done.add(n); order.push(n);
};
Object.keys(tables).forEach((n) => visit(n));
const BATCH = 400;
let loaded = 0, skipped = 0;
for (const name of order) {
  const rows = data[name], t = tables[name];
  const { count, error: ce } = await admin.from(name).select("*", { count: "exact", head: true });
  if (ce) { console.error(`✗ ${name}: 표를 찾을 수 없음/읽기 실패 — ${ce.code} ${ce.message}`); process.exit(1); }
  const canUpsert = t.pk.length > 0 && t.pk.every((k) => rows[0] && k in rows[0]);
  if (count === rows.length) { skipped++; continue; }
  if (!canUpsert && count > 0) { console.error(`✗ ${name}: 기본키로 덮어쓸 수 없는 표인데 이미 ${count}행이 있어 중단(수동 확인 필요)`); process.exit(1); }
  const oneBatch = t.fks.some((f) => f.ref === name) ? rows.length : BATCH; // 자기 연결이 있는 표는 한 요청에 전부
  for (let i = 0; i < rows.length; i += oneBatch) {
    const part = rows.slice(i, i + oneBatch);
    const q = canUpsert ? admin.from(name).upsert(part, { onConflict: t.pk.join(",") }) : admin.from(name).insert(part);
    const { error } = await q;
    if (error) { console.error(`✗ ${name} ${i}~${i + part.length}: ${error.code} ${error.message}`); process.exit(1); }
  }
  loaded++; console.log(`  ✓ ${name} ${rows.length}행`);
}
console.log(`적재 완료: 올린 표 ${loaded}개 · 이미 같은 행 수라 건너뛴 표 ${skipped}개`);
