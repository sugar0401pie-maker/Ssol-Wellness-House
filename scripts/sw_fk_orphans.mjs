// 11번(운영 표로 가는 연결 FK)을 실행·검증하기 전에, 연결이 끊긴 행(운영 표에 없는 id를 가리키는 sw_ob_* 행)이 있는지 읽기 전용으로 센다 (2026-10-27).
//   node --env-file=.env.local scripts/sw_fk_orphans.mjs
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const all = async (t, c) => { const o = []; for (let f = 0; ; f += 1000) { const { data, error } = await a.from(t).select(c).range(f, f + 999); if (error) throw new Error(`${t}: ${error.message}`); o.push(...data); if (data.length < 1000) return o; } };
const ids = async (t, c) => new Set((await all(t, c)).map((r) => r[c]));
const [concepts, practices, signals] = await Promise.all([ids("theory_concepts", "concept_id"), ids("wellness_practices", "id"), ids("theory_signals", "signal_id")]);
const CHECKS = [["sw_ob_root_concepts", "concept_id", concepts, "theory_concepts"], ["sw_ob_node_concepts", "concept_id", concepts, "theory_concepts"], ["sw_ob_root_practices", "practice_id", practices, "wellness_practices"],
  ["sw_ob_root_practice_avoid", "practice_id", practices, "wellness_practices"], ["sw_ob_choice_practice_candidates", "practice_id", practices, "wellness_practices"], ["sw_ob_signal_roots", "signal_id", signals, "theory_signals"],
  ["sw_ob_signal_unrooted", "signal_id", signals, "theory_signals"], ["sw_ob_signal_review", "signal_id", signals, "theory_signals"]];
let total = 0;
for (const [t, c, set, ref] of CHECKS) {
  const rows = await all(t, c); const bad = rows.filter((r) => r[c] != null && !set.has(r[c]));
  total += bad.length; console.log(`${bad.length ? "✗" : "✓"} ${t}.${c} → ${ref}: 전체 ${rows.length}행 중 끊긴 행 ${bad.length}${bad.length ? ` (예: ${[...new Set(bad.map((r) => r[c]))].slice(0, 5).join(", ")})` : ""}`);
}
console.log(total ? `\n끊긴 연결 ${total}행 — 11번을 실행해도 NOT VALID로는 붙지만 validate는 실패합니다.` : "\n끊긴 연결 없음 — 11번 실행 후 validate constraint 가능");
