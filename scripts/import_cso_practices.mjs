// CSO 개발 전달 묶음(2026-10-27)의 새 실천을 운영 실천 표(wellness_practices + practice_eligibility)에 넣는다.
//   python3 scripts/cso_practices_to_json.py <03_실천 폴더> <json>   →   node --env-file=.env.local scripts/import_cso_practices.mjs <json> [--apply]
// 기본은 검사만(DB에 쓰지 않음). --apply를 붙여야 넣는다. 같은 ID는 덮어쓰는 upsert라 여러 번 실행해도 안전하다.
// 기존 실천(origin이 CSO_2026_10이 아닌 것)과 ID가 겹치면 아무것도 쓰지 않고 멈춘다. 대화 내용·개인정보는 다루지 않는다.
//
// 매핑(운영에 이미 있는 THEORY_KB 실천과 같은 모양):
//  영역(1순위)→domain · 2순위 영역→secondary_domains · 단계→tier(CSO의 "한 걸음 더"는 우리 3단계에 없어 "꾸준히 이어가기"로) · 노출 조건 "일반(항상)"→availability general, "탐색 뒤에만"→after_explore
//  출처 이론→source_theory_id · 출처 기법→source_technique · 연결 개념(예: "RT-C13 내가 고를 수 있는 부분")→concept_id(앞 코드만) · 제안 이유→suggest_reason · 대처 방식 적합→coping_fit
//  이론 6개 기반(THX-*) 실천은 해당 이론·개념이 운영 이론 표에 들어간 뒤에만 넣는다(없으면 건너뛰고 알려 줌 — 이론 표 적재는 따로).
//  검수 상태는 CSO가 "초안(사람 승인 필요)"로 표시 → review_status DRAFT_HUMAN_APPROVAL_REQUIRED(앱은 이 상태도 노출한다 — CSO 결정 12 검수 게이트 끔).
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const jsonPath = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!jsonPath) { console.error("사용법: node --env-file=.env.local scripts/import_cso_practices.mjs <json> [--apply]"); process.exit(1); }
const D = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ORIGIN = "CSO_2026_10";
const DOMAINS = new Set(["나 자신", "관계", "연애", "커리어", "육아", "삶의 방향"]);
const TIER = (t) => (t === "한 걸음 더" ? "꾸준히 이어가기" : t);
const CODE_OF_DOMAIN = { "나 자신": "SELF", 커리어: "WORK", 연애: "COUPLE", 관계: "REL", 육아: "PARENT", "삶의 방향": "SELF" };
const yes = (v) => v === "예";
const list = (v) => String(v ?? "").split(/\s*[·,]\s*/).map((s) => s.trim()).filter(Boolean);
const num = (v) => (v === "" || v == null ? null : Number(v));
const fail = (m) => { console.error("❌ " + m); process.exit(1); };

const { data: theories } = await admin.from("counseling_theories").select("theory_id");
const { data: concepts } = await admin.from("theory_concepts").select("concept_id");
const T = new Set((theories ?? []).map((t) => t.theory_id)), C = new Set((concepts ?? []).map((c) => c.concept_id));
const ids = D.practices.map((p) => p.ID);
if (new Set(ids).size !== ids.length) fail("실천 ID 중복");
const { data: clash } = await admin.from("wellness_practices").select("id, origin").in("id", ids);
const bad = (clash ?? []).filter((r) => r.origin !== ORIGIN);
if (bad.length) fail(`기존 실천과 ID가 겹칩니다(덮어쓰지 않음): ${bad.slice(0, 5).map((r) => r.id).join(", ")}`);

const prac = [], elig = [], skipped = [];
for (const p of D.practices) {
  const e = D.elig[p.ID];
  if (!e) fail(`${p.ID}: 적격성 상세가 없음`);
  if (!DOMAINS.has(p["영역(1순위)"])) fail(`${p.ID}: 알 수 없는 영역 ${p["영역(1순위)"]}`);
  if (!p["제목"] || !p["설명"]) fail(`${p.ID}: 제목/설명이 비어 있음`);
  const theory = p["출처 이론"] || null;
  const conceptId = String(p["연결 개념"] ?? "").split(/\s+/)[0] || null;
  if (theory && !T.has(theory)) { skipped.push(`${p.ID}(이론 ${theory} 없음)`); continue; }
  const sec = list(p["2순위 영역"]).filter((d) => DOMAINS.has(d));
  prac.push({
    id: p.ID, domain: p["영역(1순위)"], category: p["카테고리"], tier: TIER(p["단계"]), title: p["제목"], detail: p["설명"], origin: ORIGIN,
    secondary_domains: sec, availability: p["노출 조건"] === "탐색 뒤에만" ? "after_explore" : "general", exposure_flag: false, exposure_step: null,
    coping_fit: p["대처 방식 적합"] || null, concept_id: conceptId && C.has(conceptId) ? conceptId : null, suggest_reason: p["제안 이유(사용자에게 보이는 한 줄)"] || null,
    source_theory_id: theory, source_technique: p["출처 기법"] || null,
  });
  const partner = yes(e["파트너 필요"]), child = yes(e["아이 돌봄 필요"]), work = yes(e["업무 맥락 필요"]), other = yes(e["다른 사람 필요"]);
  const audience = e["대상 구분"] || (partner ? "COUPLE" : child ? "PARENT" : work ? "WORK" : other ? "REL" : CODE_OF_DOMAIN[p["영역(1순위)"]] ?? "SELF");
  elig.push({
    practice_id: p.ID, audience_mode: audience, requires_partner: partner, requires_childcare: child, requires_work: work, requires_other_person: other,
    work_context: e["업무 맥락"] || "none", allowed_primary_activity: list(e["허용되는 주된 활동"]),
    q4_value_codes: list(e["Q4 가치 코드"]), q5_hobby_codes: list(e["Q5 취미 코드"]), q6_weekend_codes: list(e["Q6 주말 코드"]), q7_focus_codes: list(e["Q7 관심 영역 코드"]), q9_exclusion_codes: list(e["Q9 제외 활동 코드"]),
    estimated_min_minutes: num(e["예상 최소(분)"]), estimated_max_minutes: num(e["예상 최대(분)"]), time_evidence: e["시간 근거"] || "editorial_estimate_not_user_tested",
    safety_tags: list(e["안전 태그"]), review_status: "DRAFT_HUMAN_APPROVAL_REQUIRED",
    review_note: [e["검수 메모"], p["단계"] === "한 걸음 더" ? "CSO 단계 '한 걸음 더' → 꾸준히 이어가기로 넣음" : ""].filter(Boolean).join(" · ") || null,
  });
}
const byFile = {}; for (const p of D.practices) byFile[p._file] = (byFile[p._file] ?? 0) + 1;
console.log("검사:", { 읽은_실천: D.practices.length, 넣을_실천: prac.length, 건너뜀: skipped.length, 파일별: byFile });
if (skipped.length) console.log("건너뜀(이론 표에 아직 없음):", skipped.slice(0, 6).join(", "), skipped.length > 6 ? `… 외 ${skipped.length - 6}개` : "");
if (!APPLY) { console.log("검사만 했습니다(DB 변경 없음). 넣으려면 --apply 를 붙이세요."); process.exit(0); }
const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
for (const part of chunks(prac, 100)) { const { error } = await admin.from("wellness_practices").upsert(part, { onConflict: "id" }); if (error) fail("wellness_practices 저장 실패: " + error.message); }
for (const part of chunks(elig, 100)) { const { error } = await admin.from("practice_eligibility").upsert(part, { onConflict: "practice_id" }); if (error) fail("practice_eligibility 저장 실패: " + error.message); }
console.log(`✅ 실천 ${prac.length}개 + 적격성 ${elig.length}개 저장`);
