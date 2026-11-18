// CSO 묶음 v2.24(2026-11-18)의 새 실천 848개를 운영 실천표(wellness_practices + practice_eligibility)에 넣고,
// 실천↔이론 연결(theory_practice_links)과 라운드테이블 승인(11-10, 1,544개) 표시를 반영한다.
//   python3 scripts/cso_v224_practices_to_json.py <03_실천> <json>  →  node --env-file=.env.local scripts/import_cso_v224.mjs <json> [--apply]
// 기본은 검사만(DB에 쓰지 않음). 같은 ID는 덮어쓰는 upsert라 여러 번 실행해도 안전하다. 기존 실천(다른 origin)과 ID가 겹치면 멈춘다.
// 값 변환(이 묶음의 초안 파일은 운영 실천표와 쓰는 말이 달라서 — 2026-11-18 결정, CLAUDE.md 기록):
//  영역: 나→나 자신 · 일→커리어 · 연인→연애 · 관계→관계 · 공통→나 자신(+2순위 영역 전부: 어떤 고민에서도 후보가 되게)
//  단계: 관찰→가볍게 시작 · 수용→꾸준히 이어가기 · 통합→장기 습관·정체성으로(엔진 알아차림→받아들임→바꿔 감 순서)
//  카테고리가 없는 파일은 형식으로: 몸→감각 알아차리기 · 생각→생각 다시 보기 · 말→관계·대화로 풀기 · 글→내 패턴 살펴보기 · 행동→작게 시도하기
//  검수 상태: approved(라운드테이블) → APPROVED · draft → DRAFT_HUMAN_APPROVAL_REQUIRED(앱은 이 상태도 노출 — CSO 결정 12 검수 게이트 끔)
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [jsonPath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const APPLY = process.argv.includes("--apply");
if (!jsonPath) { console.error("사용법: node --env-file=.env.local scripts/import_cso_v224.mjs <json> [--apply]"); process.exit(1); }
const D = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ORIGIN = "CSO_2026_11";
const fail = (m) => { console.error("❌ " + m); process.exit(1); };
const page = async (t, c, o) => { const r = []; for (let f = 0; ; f += 1000) { const { data, error } = await admin.from(t).select(c).order(o).range(f, f + 999); if (error) fail(`${t}: ${error.message}`); r.push(...data); if (data.length < 1000) return r; } };

const DOMAIN = { "나 자신": "나 자신", 나: "나 자신", 관계: "관계", 연애: "연애", 연인: "연애", 커리어: "커리어", 일: "커리어", 육아: "육아", "삶의 방향": "삶의 방향", 공통: "나 자신" };
const ALL_SECONDARY = ["관계", "연애", "커리어", "삶의 방향"];
const TIER = { 관찰: "가볍게 시작", 수용: "꾸준히 이어가기", 통합: "장기 습관·정체성으로", "가볍게 시작": "가볍게 시작", "꾸준히 이어가기": "꾸준히 이어가기", "장기 습관·정체성으로": "장기 습관·정체성으로", "한 걸음 더": "꾸준히 이어가기" };
const CAT_BY_FORMAT = { 몸: "감각 알아차리기", 생각: "생각 다시 보기", 말: "관계·대화로 풀기", 글: "내 패턴 살펴보기", 행동: "작게 시도하기" };
const yes = (v) => v === "예";
const list = (v) => String(v ?? "").split(/\s*[·,]\s*/).map((s) => s.trim()).filter(Boolean);
const num = (v) => (v === "" || v == null ? null : Number(v));
const COMPAT = { "잘 맞음": "fit", 맞음: "fit", 보통: "neutral", 충돌: "conflict" };

const theories = new Set((await page("counseling_theories", "theory_id", "theory_id")).map((t) => t.theory_id));
const concepts = new Set((await page("theory_concepts", "concept_id", "concept_id")).map((c) => c.concept_id));
const ids = D.practices.map((p) => p.ID);
if (new Set(ids).size !== ids.length) fail("실천 ID 중복");
const existing = await page("wellness_practices", "id,origin", "id");
const exMap = new Map(existing.map((r) => [r.id, r.origin]));
const clash = ids.filter((id) => exMap.has(id) && exMap.get(id) !== ORIGIN);
if (clash.length) fail(`기존 실천과 ID가 겹칩니다(덮어쓰지 않음): ${clash.slice(0, 5).join(", ")}`);

const prac = [], elig = [], warn = [];
for (const p of D.practices) {
  const domRaw = p["영역(1순위)"]; const domain = DOMAIN[domRaw];
  if (!domain) fail(`${p.ID}: 알 수 없는 영역 ${domRaw}`);
  const tier = TIER[p["단계"]]; if (!tier) fail(`${p.ID}: 알 수 없는 단계 ${p["단계"]}`);
  const category = p["카테고리"] || CAT_BY_FORMAT[p["형식"]] || "생각 다시 보기";
  if (!p["제목"] || !p["설명"]) fail(`${p.ID}: 제목/설명이 비어 있음`);
  let theory = p["출처 이론"] || null;
  if (theory && !theories.has(theory)) { warn.push(`${p.ID}(이론 ${theory} 없음 → 비워 둠)`); theory = null; }
  const conceptId = String(p["연결 개념"] ?? "").split(/\s+/)[0] || null;
  const sec = domRaw === "공통" ? ALL_SECONDARY : list(p["2순위 영역"]).map((d) => DOMAIN[d]).filter((d) => d && d !== domain);
  prac.push({
    id: p.ID, domain, category, tier, title: p["제목"], detail: p["설명"], origin: ORIGIN, secondary_domains: [...new Set(sec)],
    availability: p["노출 조건"] === "탐색 뒤에만" ? "after_explore" : "general", exposure_flag: false, exposure_step: null,
    coping_fit: p["대처 방식 적합"] || p["쏘웰라 대처 방향"] || null, concept_id: conceptId && concepts.has(conceptId) ? conceptId : null,
    suggest_reason: p["제안 이유(사용자에게 보여줄 한 줄)"] || p["제안 이유(사용자에게 보이는 한 줄)"] || null, source_theory_id: theory, source_technique: p["출처 기법"] || null,
  });
  const partner = yes(p["파트너 필요"]), child = yes(p["아이 돌봄 필요"]), work = yes(p["재직 필요"]) || yes(p["업무 맥락"]), other = yes(p["다른 사람 필요"]);
  const approved = String(p["검수 상태"] ?? "").startsWith("approved");
  elig.push({
    practice_id: p.ID, audience_mode: partner ? "COUPLE" : child ? "PARENT" : work ? "WORK" : other ? "REL" : "SELF",
    requires_partner: partner, requires_childcare: child, requires_work: work, requires_other_person: other, work_context: work ? "work" : "none",
    allowed_primary_activity: [], q4_value_codes: [], q5_hobby_codes: [], q6_weekend_codes: [], q7_focus_codes: [], q9_exclusion_codes: [],
    estimated_min_minutes: num(p["예상 시간(최소 분)"]), estimated_max_minutes: num(p["예상 시간(최대 분)"]), time_evidence: "editorial_estimate_not_user_tested",
    safety_tags: list(p["안전 태그"]), review_status: approved ? "APPROVED" : "DRAFT_HUMAN_APPROVAL_REQUIRED",
    review_note: [`CSO 묶음 v2.24 ${p._file}`, p["검수 상태"], domRaw !== domain ? `영역 ${domRaw}→${domain}` : "", TIER[p["단계"]] !== p["단계"] ? `단계 ${p["단계"]}→${tier}` : ""].filter(Boolean).join(" · "),
  });
}

// 실천↔이론 연결: 실천이 운영표에 있고(이번에 넣는 것 포함) 이론이 있는 것만. 같은 (이론·실천) 짝이 이미 있으면 기존 검수 연결을 남기고 건너뜀(짝이 겹치면 궁합 판단이 둘이 되므로).
const allIds = new Set([...exMap.keys(), ...ids]);
const have = new Set((await page("theory_practice_links", "theory_id,practice_id", "id")).map((r) => `${r.theory_id}|${r.practice_id}`));
const links = [], linkSkip = { 실천없음: 0, 이론없음: 0, 이미있음: 0 };
for (const l of D.links) {
  const key = `${l["이론"]}|${l["실천 id"]}`;
  if (!allIds.has(l["실천 id"])) { linkSkip.실천없음++; continue; }
  if (!theories.has(l["이론"])) { linkSkip.이론없음++; continue; }
  if (have.has(key)) { linkSkip.이미있음++; continue; }
  have.add(key);
  links.push({ theory_id: l["이론"], practice_id: l["실천 id"], concept_or_technique: l["개념 id"] || null, compatibility: COMPAT[l["맞음"]] ?? "neutral", relation: l["주/보조"] === "주" ? "주 이론" : "보조 이론", basis: l["이유"] || null, review_status: "APPROVED" });
}
// 라운드테이블 승인(11-10, 1,544개): 초안 표시인 기존 실천을 APPROVED로(제목이 없어 사람 검토가 필요한 13개는 그대로 — 앱이 안 내보냄).
const eligNow = await page("practice_eligibility", "practice_id,review_status", "practice_id");
const toApprove = eligNow.filter((r) => D.approved_ids.includes(r.practice_id) && r.review_status === "DRAFT_HUMAN_APPROVAL_REQUIRED").map((r) => r.practice_id);
const notInDb = D.approved_ids.filter((id) => !allIds.has(id));

const byFile = {}; for (const p of D.practices) byFile[p._file] = (byFile[p._file] ?? 0) + 1;
console.log("검사:", { 넣을_실천: prac.length, 파일별: byFile, 새_이론연결: links.length, 연결_건너뜀: linkSkip, 승인으로_바꿀_기존실천: toApprove.length, 승인목록중_운영에없는ID: notInDb.length });
if (warn.length) console.log("주의:", warn.slice(0, 6).join(", "), warn.length > 6 ? `… 외 ${warn.length - 6}` : "");
if (!APPLY) { console.log("검사만 했습니다(DB 변경 없음). 넣으려면 --apply 를 붙이세요."); process.exit(0); }
const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
for (const part of chunks(prac, 200)) { const { error } = await admin.from("wellness_practices").upsert(part, { onConflict: "id" }); if (error) fail("wellness_practices 저장 실패: " + error.message); }
for (const part of chunks(elig, 200)) { const { error } = await admin.from("practice_eligibility").upsert(part, { onConflict: "practice_id" }); if (error) fail("practice_eligibility 저장 실패: " + error.message); }
for (const part of chunks(links, 500)) { const { error } = await admin.from("theory_practice_links").insert(part); if (error) fail("theory_practice_links 저장 실패: " + error.message); }
for (const part of chunks(toApprove, 200)) { const { error } = await admin.from("practice_eligibility").update({ review_status: "APPROVED", review_note: "라운드테이블 승인(2026-11-10) — CSO 묶음 v2.24" }).in("practice_id", part); if (error) fail("승인 표시 실패: " + error.message); }
console.log(`✅ 실천 ${prac.length} · 적격성 ${elig.length} · 이론 연결 ${links.length} · 승인 표시 ${toApprove.length}`);
