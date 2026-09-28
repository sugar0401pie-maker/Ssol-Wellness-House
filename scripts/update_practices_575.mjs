// wellness_practices의 title/detail을 owner가 검수 요청한 "SSOL_575_Practices_Pipeline_Aligned_v1"
// 결과로 업데이트한다. 도메인/카테고리/티어/origin 등 다른 컬럼은 건드리지 않는다 — 이 프로젝트는
// 제목·설명 문구만 다뤘다는 owner 문서 자체의 범위 제한을 그대로 따른다(practice_eligibility의
// q4~q9 코드도 "원본 그대로 가져왔다"고 명시돼 있어 손대지 않는다).
//
// 입력 JSON은 xlsx의 "전체_575개" 시트에서 뽑은 [{id, title, detail}, ...] 배열이다(원본 xlsx는
// 다른 지식 소스 파일들처럼 저장소에 커밋하지 않는다).
//
// 사용법: node --env-file=.env.local scripts/update_practices_575.mjs <json path>
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error("사용법: node --env-file=.env.local scripts/update_practices_575.mjs <json path>");
  process.exit(1);
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const rows = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

let updated = 0;
let unchanged = 0;
let failed = 0;

// 한 번에 너무 많이 동시 요청하지 않도록 20개씩 묶어서 처리한다.
const CHUNK = 20;
for (let i = 0; i < rows.length; i += CHUNK) {
  const batch = rows.slice(i, i + CHUNK);
  const results = await Promise.all(
    batch.map(async (r) => {
      const { data: current } = await admin.from("wellness_practices").select("title, detail").eq("id", r.id).maybeSingle();
      if (current && current.title === r.title && current.detail === r.detail) return { id: r.id, status: "unchanged" };
      const { error } = await admin.from("wellness_practices").update({ title: r.title, detail: r.detail }).eq("id", r.id);
      if (error) return { id: r.id, status: "failed", error: error.message };
      return { id: r.id, status: "updated" };
    }),
  );
  for (const res of results) {
    if (res.status === "updated") updated++;
    else if (res.status === "unchanged") unchanged++;
    else {
      failed++;
      console.error(`실패: ${res.id} — ${res.error}`);
    }
  }
  console.log(`진행: ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
}

console.log(`\n완료 — 업데이트 ${updated}건, 변경 없음 ${unchanged}건, 실패 ${failed}건`);
