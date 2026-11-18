// CSO 묶음 v2.24의 실천 설명 다시 쓰기(SSOL_Practices_DescRewrite_v0.1.xlsx, 330개)를 운영 실천표(wellness_practices.detail)에 반영한다.
// 대표님 지시(2026-11-18 "넣으렴") — 판정 칸이 비어 있어도 넣는다. 바꾸기 전 설명은 --backup 경로에 JSON으로 남긴다(되돌릴 때 씀).
//   node --env-file=.env.local scripts/apply_desc_rewrite_v224.mjs <json> --backup <백업.json> [--apply]
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const args = process.argv.slice(2);
const jsonPath = args[0]; const bi = args.indexOf("--backup"); const backup = bi >= 0 ? args[bi + 1] : null; const APPLY = args.includes("--apply");
if (!jsonPath || !backup) { console.error("사용법: <json> --backup <백업.json> [--apply]"); process.exit(1); }
const rows = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ids = rows.map((r) => r.id);
const cur = [];
for (let i = 0; i < ids.length; i += 200) { const { data, error } = await a.from("wellness_practices").select("id,title,detail").in("id", ids.slice(i, i + 200)); if (error) throw error; cur.push(...data); }
const curMap = new Map(cur.map((r) => [r.id, r]));
const missing = ids.filter((id) => !curMap.has(id));
const changes = rows.filter((r) => curMap.has(r.id) && r.detail && r.detail.trim() && r.detail.trim() !== curMap.get(r.id).detail);
const titleMismatch = rows.filter((r) => curMap.has(r.id) && r.title && r.title !== curMap.get(r.id).title).length;
console.log(`설명 다시 쓰기 ${rows.length}개 · 운영에 없는 ID ${missing.length} · 바뀌는 설명 ${changes.length} · 제목이 다른 행 ${titleMismatch}(제목은 바꾸지 않음)`);
if (missing.length) console.log("없는 ID 예:", missing.slice(0, 5).join(", "));
if (!APPLY) { console.log("검사만 했습니다."); process.exit(0); }
fs.writeFileSync(backup, JSON.stringify(changes.map((r) => ({ id: r.id, detail: curMap.get(r.id).detail })), null, 1));
for (const r of changes) { const { error } = await a.from("wellness_practices").update({ detail: r.detail.trim(), updated_at: new Date().toISOString() }).eq("id", r.id); if (error) throw error; }
console.log(`✅ 설명 ${changes.length}개 바꿈 · 예전 설명 백업: ${backup}`);
