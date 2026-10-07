// matching_eval_set의 정답 라벨을 owner 재판정 결과로 갱신한다(2026-10-07).
//   node --env-file=.env.local scripts/update_eval_labels.mjs <label_updates.json> [--dry-run]
// 원래 라벨은 check_point 끝에 "[재판정 2026-10-07] 원래 정답: …"으로 남기고, 이미 갱신된 줄(같은 표시가 있는 줄)은 건너뛰어 여러 번 실행해도 안전하다.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const U = JSON.parse(fs.readFileSync(process.argv[2], "utf-8")), dry = process.argv.includes("--dry-run");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: cur } = await admin.from("matching_eval_set").select("eval_id, expected_label, check_point");
const byId = new Map(cur.map((r) => [r.eval_id, r]));
const MARK = "[재판정 2026-10-07]";
let n = 0, skipped = 0, missing = [];
for (const u of U) {
  const row = byId.get(u.id);
  if (!row) { missing.push(u.id); continue; }
  if ((row.check_point ?? "").includes(MARK)) { skipped++; continue; }
  const note = `${MARK} 원래 정답: ${row.expected_label ?? "(없음)"} / 채점: ${u.status}${u.fit ? " / 적합도: " + u.fit : ""}${u.act ? " / 처리: " + u.act : ""}`;
  const check_point = row.check_point ? `${row.check_point} | ${note}` : note;
  if (dry) { console.log(u.id, "→", u.fixed.slice(0, 60)); n++; continue; }
  const { error } = await admin.from("matching_eval_set").update({ expected_label: u.fixed, check_point }).eq("eval_id", u.id);
  if (error) { console.error(u.id, error.message); process.exit(1); }
  n++;
}
console.log(dry ? "dry-run" : "갱신", n, "건, 건너뜀", skipped, "건, DB에 없는 ID", missing.length ? missing.join(",") : "없음");
