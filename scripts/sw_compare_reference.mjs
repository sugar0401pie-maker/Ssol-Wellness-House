// 읽기 전용 점검(2026-10-20): CSO가 새 버전 CSV를 줄 때, 운영 DB(이전 버전 적재분)와 표별로 비교한다 — 같은 기본키의 행이 달라졌는지, 늘고 줄었는지, 새 칸이 있는지.
//   node --env-file=.env.local scripts/sw_compare_reference.mjs <CSV 폴더> <새 10_sw_reference_tables_v*.sql> [SAMPLES=1 로 바뀐 값 예시 출력]
import fs from "node:fs"; import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseCsv } from "./sw_csv.mjs";
try { process.loadEnvFile(".env.local"); } catch {}
const DIR = process.argv[2], SQL = process.argv[3];
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const sql = fs.readFileSync(SQL, "utf8"); const pk = {};
for (const m of sql.matchAll(/create table if not exists public\.(sw_ob_\w+) \(\n([\s\S]*?)\n\);/g)) { const p = m[2].match(/primary key \(([^)]*)\)/); if (p) pk[m[1]] = p[1].split(",").map((s) => s.trim()); }
const readCsv = (t) => { const r = parseCsv(fs.readFileSync(path.join(DIR, t + ".csv"), "utf8")).filter((x) => !(x.length === 1 && x[0] === null)); const h = r.shift(); return { h, rows: r.map((x) => Object.fromEntries(h.map((k, i) => [k, x[i]]))) }; };
const live = async (t) => { const o = []; for (let f = 0; ; f += 1000) { const { data, error } = await a.from(t).select("*").range(f, f + 999); if (error) return null; o.push(...data); if (data.length < 1000) return o; } };
const norm = (v) => (v === null || v === undefined || v === "" ? "" : typeof v === "object" ? JSON.stringify(JSON.parse(JSON.stringify(v))) : String(v).trim());
const canon = (x) => (Array.isArray(x) ? x.map(canon) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x);
const jn = (v) => { if (v === true || v === "true" || v === "True" || v === "t") return "true"; if (v === false || v === "false" || v === "False" || v === "f") return "false"; if (typeof v === "number") return String(v); if (typeof v === "string") { try { const j = JSON.parse(v); if (typeof j === "number") return String(j); return JSON.stringify(canon(j)); } catch { return v.trim(); } } if (v && typeof v === "object") return JSON.stringify(canon(v)); return norm(v); };
const SAMPLE = {};
const out = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).sort()) {
  const t = f.replace(".csv", ""); const { h, rows } = readCsv(t); const L = await live(t);
  if (!L) { out.push(`${t.padEnd(34)} 새 표(운영 DB에 없음) csv ${rows.length}행`); continue; }
  const keys = (pk[t] ?? [h[0]]).filter((k) => h.includes(k)); const kf = (r) => keys.map((k) => norm(r[k])).join("¦");
  const lm = new Map(L.map((r) => [kf(r), r])); const cm = new Map(rows.map((r) => [kf(r), r]));
  const added = [...cm.keys()].filter((k) => !lm.has(k)), removed = [...lm.keys()].filter((k) => !cm.has(k));
  const cols = h.filter((c) => L[0] && c in L[0]); let changed = 0; const colHits = {};
  for (const [k, r] of cm) { const l = lm.get(k); if (!l) continue; let diff = false; for (const c of cols) { if (jn(r[c]) !== jn(l[c])) { diff = true; colHits[c] = (colHits[c] ?? 0) + 1; (SAMPLE[t + "." + c] ??= []).length < 2 && SAMPLE[t + "." + c].push([k, jn(l[c]).slice(0, 220), jn(r[c]).slice(0, 220)]); } } if (diff) changed++; }
  const newCols = h.filter((c) => L[0] && !(c in L[0]));
  const flag = added.length || removed.length || changed || newCols.length ? "△" : "=";
  out.push(`${flag} ${t.padEnd(32)} 운영 ${String(L.length).padStart(5)} → csv ${String(rows.length).padStart(5)} · 추가 ${added.length} 삭제 ${removed.length} 바뀐 행 ${changed}${newCols.length ? " · 새 칸 " + newCols.join(",") : ""}${changed ? " · 바뀐 칸 " + Object.entries(colHits).map(([c, n]) => c + ":" + n).join(",") : ""}`);
  if (process.env.SHOW && (process.env.SHOW === t)) { for (const k of removed.slice(0, 10)) console.log("  삭제:", k); for (const k of added.slice(0, 10)) console.log("  추가:", k); }
}
console.log(out.filter((l) => l.startsWith("△") || l.startsWith("sw_")).join("\n"));
if (process.env.SAMPLES) for (const [k, v] of Object.entries(SAMPLE)) { console.log("\n##", k); for (const [key, a, b] of v) console.log("  키", key, "\n   운영:", a, "\n   새것:", b); }
