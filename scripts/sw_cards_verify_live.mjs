// 선택지 카드 데이터 검증(읽기 전용): 운영 DB(sw_ob_choice_*)에서 읽어 buildCardData로 만든 결과가 CSO 시험용 JSON(저장소 보관본)과 같은지 본다.
//   node --env-file=.env.local scripts/sw_cards_verify_live.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { buildCardData } from "../lib/cards/data.ts";

const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const all = async (t) => { const o = []; for (let f = 0; ; f += 1000) { const { data, error } = await a.from(t).select("*").order(Object.keys((await a.from(t).select("*").limit(1)).data[0])[0]).range(f, f + 999); if (error) throw new Error(t + " " + error.code); o.push(...data); if (data.length < 1000) return o; } };
const live = buildCardData({ scenes: await all("sw_ob_choice_scenes"), cards: await all("sw_ob_choice_cards"), options: await all("sw_ob_choice_options"), fixed: await all("sw_ob_choice_cards_fixed"), confirm: await all("sw_ob_choice_confirm"), practices: await all("sw_ob_choice_practice_candidates") });
const fx = JSON.parse(fs.readFileSync(new URL("../lib/cards/__fixtures__/choice_cards_fixture.json", import.meta.url), "utf8"));
const norm = (d) => { const j = JSON.parse(JSON.stringify(d, (k, v) => (k === "candidates" ? [...v].sort((x, y) => x.practice_id.localeCompare(y.practice_id)) : v))); return Array.isArray(j) && j[0]?.key ? j.sort((x, y) => x.key.localeCompare(y.key)) : j; }; // 장면은 순서가 의미 없어 키 순으로 맞춰 비교
let bad = 0;
for (const k of ["scenes", "cards", "options", "fixed", "confirm"]) {
  try { assert.deepEqual(norm(live[k]), norm(fx[k])); console.log(`✅ ${k} 일치`); } catch (e) {
    bad++; console.log(`❌ ${k} 불일치`);
    if (k === "options" || k === "cards") { const diff = Object.keys(fx[k]).filter((id) => { try { assert.deepEqual(norm(live[k][id]), norm(fx[k][id])); return false; } catch { return true; } }); console.log("   다른 항목", diff.length, diff.slice(0, 5)); const id = diff[0]; if (id) for (const f of Object.keys(fx[k][id])) { try { assert.deepEqual(norm(live[k][id][f]), norm(fx[k][id][f])); } catch { console.log("   ", id, f, JSON.stringify(live[k][id][f])?.slice(0, 160), "≠", JSON.stringify(fx[k][id][f])?.slice(0, 160)); } } }
    else console.log("   ", JSON.stringify(live[k]).slice(0, 200), "\n   ", JSON.stringify(fx[k]).slice(0, 200));
  }
}
console.log(bad ? `\n불일치 ${bad}건` : "\n전부 일치"); process.exit(bad ? 1 : 0);
