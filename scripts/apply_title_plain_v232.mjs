// CSO 묶음 v2.32(판정 기준 마스터 v1.9 시트 31 "쉬운 말로 바꾼 것")의 실천 제목 97개를 운영 실천표(wellness_practices.title)에 반영한다.
// CSO 결정(2026-11-23 「바꿔라」) — 해석 DB(sw_ob_practice_ref.title)는 SQL 18이 이미 바꿨고, 화면·추천에 쓰는 운영 실천표도 같은 판으로 맞춘다.
// 지금 제목이 "바꾸기 전" 문구와 같은 행만 바꾼다(이미 다른 제목이면 건드리지 않고 알려 줌). 바꾸기 전 제목은 --backup 경로에 JSON으로 남긴다(되돌릴 때 씀).
//   node --env-file=.env.local scripts/apply_title_plain_v232.mjs <json: [{id, before, after}]> --backup <백업.json> [--apply]
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const args = process.argv.slice(2);
const jsonPath = args[0]; const bi = args.indexOf("--backup"); const backup = bi >= 0 ? args[bi + 1] : null; const APPLY = args.includes("--apply");
if (!jsonPath || !backup) { console.error("사용법: <json> --backup <백업.json> [--apply]"); process.exit(1); }
const rows = JSON.parse(fs.readFileSync(jsonPath, "utf8")).filter((r) => r.id && typeof r.after === "string" && r.after.trim());
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ids = rows.map((r) => r.id);
const cur = [];
for (let i = 0; i < ids.length; i += 200) { const { data, error } = await a.from("wellness_practices").select("id,title").in("id", ids.slice(i, i + 200)); if (error) throw error; cur.push(...data); }
const curMap = new Map(cur.map((r) => [r.id, r.title]));
const missing = ids.filter((id) => !curMap.has(id));
const done = rows.filter((r) => curMap.get(r.id) === r.after.trim());
const other = rows.filter((r) => curMap.has(r.id) && curMap.get(r.id) !== r.before && curMap.get(r.id) !== r.after.trim());
const changes = rows.filter((r) => curMap.get(r.id) === r.before);
console.log(`제목 ${rows.length}개 · 바꿀 것 ${changes.length} · 이미 바뀜 ${done.length} · 운영에 없는 ID ${missing.length} · 지금 제목이 '바꾸기 전'과 달라 건너뜀 ${other.length}`);
if (other.length) console.log("건너뜀 예:", other.slice(0, 5).map((r) => r.id).join(", "));
if (!APPLY) { console.log("검사만 했습니다."); process.exit(0); }
fs.writeFileSync(backup, JSON.stringify(changes.map((r) => ({ id: r.id, title: r.before })), null, 1));
for (const r of changes) { const { error } = await a.from("wellness_practices").update({ title: r.after.trim(), updated_at: new Date().toISOString() }).eq("id", r.id).eq("title", r.before); if (error) throw error; }
console.log(`✅ 제목 ${changes.length}개 바꿈 · 예전 제목 백업: ${backup}`);
