// 쏘웰라 해석 DB 참조표(sw_ob_*) CSV 적재 — 2026-10-18
// 기본은 "검사만"(네트워크 없음): CSV 머리글·형식·기본키 중복·표 사이 연결(FK)을 apply_v1.9.sql의 표 정의와 맞춰 본다.
// --apply 를 붙여야 실제로 DB에 올린다(서버 키 필요, .env.local). 이미 같은 행이 있으면 건너뛰거나 같은 키로 덮어쓰기라 여러 번 실행해도 안전하다.
//   node scripts/sw_load_reference.mjs --dir <CSV 폴더>            # 검사만
//   node scripts/sw_load_reference.mjs --dir <CSV 폴더> --apply    # 적재(이미 같은 행 수인 표는 건너뜀)
//   node scripts/sw_load_reference.mjs --dir <CSV 폴더> --apply --force   # 새 버전으로 갱신(전부 기본키로 덮어씀)
//   ... --apply --prune-report   # (v4.0) 새 CSV에 없어진 행(예전 버전에만 있던 행)이 DB에 몇 개 남아 있는지 표별로 보여 준다(지우지 않음)
//   ... --apply --prune          # 그 남은 행을 지운다(자식 표부터). 업서트만으로는 CSO가 뺀 행이 DB에 그대로 남기 때문 — 없는 뿌리 연결·판별 문장 등이 계속 쓰이는 것을 막는다
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
const SQL = path.resolve(opt("--sql") ?? "supabase/sw_interp/apply_v1.9.sql");
const PRUNE = flag("--prune"), PRUNE_REPORT = flag("--prune-report");
const FORCE = flag("--force"); // 새 버전 데이터로 갱신할 때: 행 수가 같아도 건너뛰지 않고 기본키로 전부 덮어쓴다(2026-10-20 — 같은 행 수라도 내용이 바뀐 표가 있어서)
if (!DIR) { console.error("사용법: --dir <CSV 폴더> [--apply]"); process.exit(2); }

// ───── 표 정의 읽기(apply_v1.9.sql의 sw_ob_ 표) ─────
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
// 표 사이 연결이 서로를 가리키는 순환(예: 카드 ↔ 보기)은 한 요청씩 올리는 방식으로는 어느 쪽도 먼저 못 들어간다.
// 순환에 걸린 연결 중 "비어도 되는 칸"은 처음에 비워 두고, 모든 표가 올라간 뒤 채운다(없으면 중단).
const reach = (from, to, seen = new Set()) => { if (from === to) return true; if (seen.has(from)) return false; seen.add(from); return tables[from].fks.some((f) => f.ref !== from && reach(f.ref, to, seen)); };
const deferred = []; // { table, fk }
for (const [n, t] of Object.entries(tables)) for (const fk of t.fks) {
  if (fk.ref === n || !reach(fk.ref, n)) continue; // 순환이 아닌 연결
  const nullable = fk.cols.every((c) => !t.cols.find((x) => x.name === c).notNull);
  if (nullable && !deferred.some((d) => d.table === n && d.fk === fk)) { deferred.push({ table: n, fk }); }
}
const isDeferred = (n, fk) => deferred.some((d) => d.table === n && d.fk === fk);
const order = []; const done = new Set();
const visit = (n, stack = []) => {
  if (done.has(n)) return;
  if (stack.includes(n)) { console.error(`✗ 순환 연결을 풀 수 없음(비어도 되는 칸이 없음): ${[...stack, n].join(" → ")}`); process.exit(1); }
  for (const fk of tables[n].fks) if (fk.ref !== n && !isDeferred(n, fk)) visit(fk.ref, [...stack, n]);
  done.add(n); order.push(n);
};
Object.keys(tables).forEach((n) => visit(n));
const deferCols = (n) => deferred.filter((d) => d.table === n).flatMap((d) => d.fk.cols);
if (deferred.length) console.log(`순환 연결 ${deferred.length}개: ${deferred.map((d) => `${d.table}(${d.fk.cols})`).join(", ")} — 나중에 채움`);
const BATCH = 400;
let loaded = 0, skipped = 0;
for (const name of order) {
  const full = data[name], t = tables[name];
  const dc = deferCols(name);
  const rows = dc.length ? full.map((o) => ({ ...o, ...Object.fromEntries(dc.map((c) => [c, null])) })) : full;
  const { count, error: ce } = await admin.from(name).select("*", { count: "exact", head: true });
  if (ce) { console.error(`✗ ${name}: 표를 찾을 수 없음/읽기 실패 — ${ce.code} ${ce.message}`); process.exit(1); }
  const canUpsert = t.pk.length > 0 && t.pk.every((k) => rows[0] && k in rows[0]);
  if (count === rows.length && !FORCE) { skipped++; continue; }
  if (!canUpsert && count === rows.length) { skipped++; console.log(`  = ${name}: 기본키가 없는 표라 덮어쓸 수 없지만 행 수가 같아 건너뜀(내용 비교는 sw_compare_reference.mjs로)`); continue; }
  if (!canUpsert && count > 0) {
    // 기본키가 없는 참조표(예: sw_ob_node_fixes)는 덮어쓸 수 없다. --force일 때만 표 전체를 비우고 새 CSV로 바꾼다(다른 표가 이 표를 가리키지 않는 참조 기록표일 때만 안전 — 가리키는 표가 있으면 삭제 단계에서 DB가 막는다).
    if (!FORCE) { console.error(`✗ ${name}: 기본키로 덮어쓸 수 없는 표인데 이미 ${count}행이 있어 중단(--force로 표 전체를 새로 바꿀 수 있음)`); process.exit(1); }
    const first = t.cols[0].name;
    const { error: de } = await admin.from(name).delete().not(first, "is", null);
    if (de) { console.error(`✗ ${name} 비우기 실패: ${de.code} ${de.message}`); process.exit(1); }
    console.log(`  ↻ ${name}: 기본키가 없어 기존 ${count}행을 비우고 새로 넣음`);
  }
  const oneBatch = t.fks.some((f) => f.ref === name) ? rows.length : BATCH; // 자기 연결이 있는 표는 한 요청에 전부
  for (let i = 0; i < rows.length; i += oneBatch) {
    const part = rows.slice(i, i + oneBatch);
    const q = canUpsert ? admin.from(name).upsert(part, { onConflict: t.pk.join(",") }) : admin.from(name).insert(part);
    const { error } = await q;
    if (error) { console.error(`✗ ${name} ${i}~${i + part.length}: ${error.code} ${error.message}`); process.exit(1); }
  }
  loaded++; console.log(`  ✓ ${name} ${rows.length}행`);
}
// 2단계: 순환 칸 채우기(같은 기본키로 전체 행을 다시 올려서 덮어씀 — 여러 번 실행해도 안전)
for (const n of new Set(deferred.map((d) => d.table))) {
  const t = tables[n], cols = deferCols(n);
  const todo = data[n].filter((o) => cols.some((c) => o[c] !== null));
  for (let i = 0; i < todo.length; i += BATCH) {
    const { error } = await admin.from(n).upsert(todo.slice(i, i + BATCH), { onConflict: t.pk.join(",") });
    if (error) { console.error(`✗ ${n} 순환 칸 채우기 ${i}: ${error.code} ${error.message}`); process.exit(1); }
  }
  console.log(`  ✓ ${n} 순환 칸(${cols}) ${todo.length}행 채움`);
}
console.log(`적재 완료: 올린 표 ${loaded}개 · 이미 같은 행 수라 건너뛴 표 ${skipped}개`);

// 3단계(v4.0): 새 CSV에 없는 행 정리. 업서트는 새 행을 더하고 바뀐 행을 고칠 뿐이라, CSO가 뺀 행은 DB에 남는다.
if (PRUNE || PRUNE_REPORT) {
  let total = 0;
  for (const name of [...order].reverse()) { // 자식 표부터 지운다(연결이 걸려 있어도 막히지 않게)
    const t = tables[name]; if (!t.pk.length || !data[name]) continue;
    if (!t.pk.every((c) => c in (data[name][0] ?? {}))) continue; // 기본키가 CSV에 없는 표(자동 번호 칸)는 행을 짝지을 수 없어 정리하지 않는다
    const key = (o) => t.pk.map((c) => JSON.stringify(o[c] ?? null)).join("|");
    const keep = new Set(data[name].map(key));
    const stale = [];
    for (let from = 0; ; from += 1000) {
      const { data: part, error } = await admin.from(name).select(t.pk.join(",")).range(from, from + 999);
      if (error) { console.error(`✗ ${name}: 정리 대상 조회 실패 ${error.code}`); process.exit(1); }
      for (const o of part ?? []) if (!keep.has(key(o))) stale.push(o);
      if ((part?.length ?? 0) < 1000) break;
    }
    if (!stale.length) continue;
    total += stale.length;
    if (PRUNE_REPORT && !PRUNE) { console.log(`  · ${name}: 새 CSV에 없는 행 ${stale.length}개`); continue; }
    for (let i = 0; i < stale.length; i += 100) {
      const part = stale.slice(i, i + 100);
      const q = t.pk.length === 1 ? admin.from(name).delete().in(t.pk[0], part.map((o) => o[t.pk[0]])) : null;
      if (q) { const { error } = await q; if (error) { console.error(`✗ ${name} 정리 실패: ${error.code} ${error.message}`); process.exit(1); } }
      else for (const o of part) { const { error } = await admin.from(name).delete().match(Object.fromEntries(t.pk.map((c) => [c, o[c]]))); if (error) { console.error(`✗ ${name} 정리 실패: ${error.code} ${error.message}`); process.exit(1); } }
    }
    console.log(`  ✂ ${name}: ${stale.length}개 지움`);
  }
  console.log(PRUNE ? `정리 완료: 총 ${total}개 행 삭제` : `정리 대상(지우지 않음): 총 ${total}개 행 — 지우려면 --prune`);
}
