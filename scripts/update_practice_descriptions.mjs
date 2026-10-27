// 실천 설명 다시 쓰기(CSO SSOL_Practices_DescRewrite_v0.1.xlsx, 330개 — 제목은 그대로, 설명만) 반영 (2026-10-27).
//   node --env-file=.env.local scripts/update_practice_descriptions.mjs <json> [--apply]
// 입력 JSON: [{id, title, old(전 설명), detail(새 설명), verdict, opinion}] — xlsx의 "새 설명" 시트에서 뽑은 것(저장소에 커밋하지 않음).
// 기본은 검사만. --apply는 "지금 DB 설명이 CSO가 본 '전 설명'과 같을 때만" 바꾼다 — 그 사이 누가 고친 설명을 덮어쓰지 않기 위해(다르면 건너뛰고 목록을 보여 줌).
// 판정 칸에 "고침 필요"가 적힌 행은 CSO 검수 의견이 남아 있다는 뜻이라 건너뛴다(고친 문장이 있으면 의견 칸의 고친 문장을 쓰지 않고, 사람이 정리한 뒤 다시 실행).
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const rows = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const APPLY = process.argv.includes("--apply");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await admin.from("wellness_practices").select("id, title, detail").in("id", rows.map((r) => r.id));
if (error) { console.error("조회 실패", error.message); process.exit(1); }
const live = new Map(data.map((r) => [r.id, r]));
const todo = [], same = [], drift = [], missing = [], review = [];
for (const r of rows) {
  const l = live.get(r.id);
  if (!l) { missing.push(r.id); continue; }
  if (r.verdict && r.verdict !== "맞음") { review.push(r.id); continue; }
  if (l.detail === r.detail) { same.push(r.id); continue; }
  if (l.detail !== r.old) { drift.push(r.id); continue; }
  if (!r.detail || r.detail.length < 20) { review.push(r.id); continue; }
  todo.push(r);
}
console.log({ 입력: rows.length, 바꿀_것: todo.length, 이미_새_설명: same.length, 그_사이_DB가_바뀜: drift.length, 운영에_없는_id: missing.length, 검수_의견_있어_건너뜀: review.length });
if (drift.length) console.log("DB 설명이 CSO가 본 것과 다른 실천(건너뜀):", drift.slice(0, 8).join(", "), drift.length > 8 ? `… 외 ${drift.length - 8}` : "");
if (missing.length) console.log("운영에 없는 id:", missing.slice(0, 8).join(", "));
if (!APPLY) { console.log("검사만 했습니다(DB 변경 없음). 반영하려면 --apply"); process.exit(0); }
let n = 0;
for (const r of todo) { const { error: e } = await admin.from("wellness_practices").update({ detail: r.detail }).eq("id", r.id).eq("detail", r.old); if (e) { console.error("✗", r.id, e.message); process.exit(1); } n++; }
console.log(`✅ ${n}개 설명 반영`);
