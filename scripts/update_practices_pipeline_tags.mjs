// wellness_practices.pipeline_tag를 채운다(migration 20260928000000 실행 후 사용).
// 값 두 종류를 함께 넣는다: (1) PARENT — owner가 2026-09-28에 신설한 8번째 태그, ID가
// "PARENT-"/"NEW-PARENT-"로 시작하는 115건 전부(문서의 기존 파이프라인 태그보다 우선한다 —
// 육아 영역이라는 정체성이 우선), (2) 나머지 — SSOL_575_Practices_Pipeline_Aligned_v1.xlsx의
// "파이프라인 태그" 컬럼에 실제로 값이 있던 47건(CORE/CALM/PERFECT/HAPPY/COMPASS/LOVE/
// RESILIENCE, '#' 제거). 태그가 없는 나머지 413건은 건드리지 않는다(null 유지).
//
// 입력 JSON은 [{id, pipeline_tag}, ...] 배열이다.
// 사용법: node --env-file=.env.local scripts/update_practices_pipeline_tags.mjs <json path>
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error("사용법: node --env-file=.env.local scripts/update_practices_pipeline_tags.mjs <json path>");
  process.exit(1);
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const rows = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

let updated = 0;
let failed = 0;
const CHUNK = 20;
for (let i = 0; i < rows.length; i += CHUNK) {
  const batch = rows.slice(i, i + CHUNK);
  const results = await Promise.all(
    batch.map(async (r) => {
      const { error } = await admin.from("wellness_practices").update({ pipeline_tag: r.pipeline_tag }).eq("id", r.id);
      return { id: r.id, error: error?.message };
    }),
  );
  for (const res of results) {
    if (res.error) {
      failed++;
      console.error(`실패: ${res.id} — ${res.error}`);
    } else updated++;
  }
  console.log(`진행: ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
}

console.log(`\n완료 — 업데이트 ${updated}건, 실패 ${failed}건`);
