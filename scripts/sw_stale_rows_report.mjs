// 새 CSV(v4.0)에서 빠졌는데 운영 DB에 남아 있는 예전 행을 읽기 전용으로 꺼내 JSON으로 저장한다 (2026-10-27). 아무것도 지우거나 바꾸지 않는다.
//   node --env-file=.env.local scripts/sw_stale_rows_report.mjs <CSV 폴더> <apply_v4.0.sql> <출력 json>
import fs from "node:fs"; import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseCsv } from "./sw_csv.mjs";
const [DIR, SQL, OUT] = process.argv.slice(2);
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const sql = fs.readFileSync(SQL, "utf8"); const pk = {};
for (const m of sql.matchAll(/create table if not exists public\.(sw_ob_\w+) \(\n([\s\S]*?)\n\);/g)) { const p = m[2].match(/primary key \(([^)]*)\)/); if (p) pk[m[1]] = p[1].split(",").map((s) => s.trim()); }
const TABLES = ["sw_ob_choice_practice_candidates", "sw_ob_claim_roots", "sw_ob_claims", "sw_ob_escalate_signals", "sw_ob_root_practice_avoid", "sw_ob_signal_unrooted"];
const csvRows = (t) => { const r = parseCsv(fs.readFileSync(path.join(DIR, t + ".csv"), "utf8")).filter((x) => !(x.length === 1 && x[0] === null)); const h = r.shift(); return r.map((x) => Object.fromEntries(h.map((c, i) => [c, x[i]]))); };
const live = async (t) => { const o = []; for (let f = 0; ; f += 1000) { const { data, error } = await a.from(t).select("*").range(f, f + 999); if (error) throw new Error(`${t}: ${error.message}`); o.push(...data); if (data.length < 1000) return o; } };
const key = (t, o) => pk[t].map((c) => String(o[c] ?? "")).join("|");
const res = {};
for (const t of TABLES) {
  const keep = new Set(csvRows(t).map((o) => key(t, o)));
  res[t] = (await live(t)).filter((o) => !keep.has(key(t, o)));
}
fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
console.log(Object.fromEntries(Object.entries(res).map(([t, r]) => [t, r.length])));
