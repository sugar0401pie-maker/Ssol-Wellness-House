// CSO 묶음 v2.40(2026-11-26, 해석 DB v5.33~v5.40)의 실천 변경을 운영 실천표(wellness_practices + practice_eligibility)에 맞춘다.
// 묶음 안내: "운영 실천표에 먼저 넣어 주세요"(CNP 23 · OUT 활동 · RNW 등 — 해석 DB의 실천 연결이 운영 실천표를 외래 키로 참조).
// 엑셀(03_실천)마다 열 모양이 달라서, 이번에는 같은 묶음의 SQL(19 · 19a~19f)에 들어 있는 해석 DB 실천 행
// (sw_ob_practice_ref · flags · area · size · theory · codes)을 그대로 읽어 운영 실천표 행을 만든다 — 두 표가 같은 판이 된다.
//   node --env-file=.env.local scripts/import_cso_v240.mjs <SSOL_DB_SQL_v5.40 폴더> [--apply]
// 하는 일: ① 운영 실천표에 없는 실천 → 새로 넣음  ② 있는 실천의 제목·설명이 해석 DB 판과 다르면 그 판으로(쉬운 말 174 · RPD-2030 등)
//          ③ 해석 DB에서 approved인데 운영 표시가 초안이면 APPROVED로(CSO 승인 54 · CNP 23).
// 기본은 검사만(DB에 쓰지 않음). 같은 ID는 덮어쓰는 upsert라 여러 번 실행해도 안전하다. 원본 SQL·엑셀은 저장소에 커밋하지 않는다.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const [dir] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const APPLY = process.argv.includes("--apply");
if (!dir) { console.error("사용법: node --env-file=.env.local scripts/import_cso_v240.mjs <SQL 폴더> [--apply]"); process.exit(1); }
const fail = (m) => { console.error("❌ " + m); process.exit(1); };
const FILES = fs.readdirSync(dir).filter((f) => /^19[a-f]?_.*\.sql$/.test(f)).sort((a, b) => a.replace(/^19_/, "19 ").localeCompare(b.replace(/^19_/, "19 ")));
if (FILES.length !== 7) fail(`19 · 19a~19f 파일 7개가 있어야 해요(찾은 것 ${FILES.length}개)`);

// ── SQL 한 줄짜리 insert 읽기: insert into public.T (a, b) values ('x', NULL, ...) ──
function parseValues(s) {
  const out = []; let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "'") { let v = ""; i++; for (;;) { if (s[i] === "'" && s[i + 1] === "'") { v += "'"; i += 2; } else if (s[i] === "'") { i++; break; } else { v += s[i++]; } } out.push(v); }
    else if (/\s|,/.test(ch)) i++;
    else { let v = ""; while (i < s.length && s[i] !== ",") v += s[i++]; v = v.trim(); out.push(/^null$/i.test(v) ? null : v); }
  }
  return out;
}
const TABLES = ["sw_ob_practice_ref", "sw_ob_practice_flags", "sw_ob_practice_area", "sw_ob_practice_size", "sw_ob_practice_theory", "sw_ob_practice_codes"];
const rows = Object.fromEntries(TABLES.map((t) => [t, []]));
for (const f of FILES) {
  for (const line of fs.readFileSync(path.join(dir, f), "utf8").split("\n")) {
    const m = /^insert into public\.(sw_ob_practice_\w+) \(([^)]*)\) values \((.*)\) on conflict/.exec(line);
    if (!m || !rows[m[1]]) continue;
    const cols = m[2].split(",").map((c) => c.trim()), vals = parseValues(m[3]);
    if (cols.length !== vals.length) fail(`${f}: 열 ${cols.length}개 · 값 ${vals.length}개가 달라요 — ${line.slice(0, 120)}`);
    rows[m[1]].push({ ...Object.fromEntries(cols.map((c, i) => [c, vals[i]])), _file: f });
  }
}
// 같은 실천은 뒤 파일이 이김(19 → 19f 순서로 덮어씀)
const last = (t, key = (r) => r.practice_id) => { const m = new Map(); for (const r of rows[t]) m.set(key(r), r); return m; };
const ref = last("sw_ob_practice_ref"), area = last("sw_ob_practice_area"), size = last("sw_ob_practice_size"), codes = last("sw_ob_practice_codes");
const stage = last("sw_ob_practice_flags", (r) => `${r.practice_id}|${r.flag}`);
const theory = new Map(); for (const r of rows.sw_ob_practice_theory) if (r.role === "주" || !theory.has(r.practice_id)) theory.set(r.practice_id, r);

const DOMAIN = { 나: "나 자신", "나 자신": "나 자신", 일: "커리어", 커리어: "커리어", 연인: "연애", 연애: "연애", 관계: "관계", 육아: "육아", "삶의 방향": "삶의 방향", 공통: "나 자신" };
const ALL_SECONDARY = ["관계", "연애", "커리어", "삶의 방향"];
const TIER = { 관찰: "가볍게 시작", 수용: "꾸준히 이어가기", 통합: "장기 습관·정체성으로" };
const CAT_BY_FORMAT = { 몸: "감각 알아차리기", 생각: "생각 다시 보기", 말: "관계·대화로 풀기", 글: "내 패턴 살펴보기", 행동: "작게 시도하기" };
const yes = (v) => v === true || v === "true" || v === "예";
const num = (v) => (v == null || v === "" ? null : Number(v));
const list = (v) => String(v ?? "").split(/\s*[·,]\s*/).map((s) => s.trim()).filter(Boolean);

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const page = async (t, c, o) => { const r = []; for (let f = 0; ; f += 1000) { const { data, error } = await admin.from(t).select(c).order(o).range(f, f + 999); if (error) fail(`${t}: ${error.message}`); r.push(...data); if (data.length < 1000) return r; } };
const cur = new Map((await page("wellness_practices", "id,title,detail", "id")).map((r) => [r.id, r]));
const elig = new Map((await page("practice_eligibility", "practice_id,review_status", "practice_id")).map((r) => [r.practice_id, r.review_status]));
const theories = new Set((await page("counseling_theories", "theory_id", "theory_id")).map((t) => t.theory_id));
const concepts = new Set((await page("theory_concepts", "concept_id", "concept_id")).map((c) => c.concept_id));

const newPrac = [], newElig = [], textUpd = [], approve = [], warn = [];
for (const [id, r] of ref) {
  const approved = String(r.review_status ?? "").startsWith("approved");
  if (!cur.has(id)) {
    const a = area.get(id)?.area, sz = size.get(id), th = theory.get(id), st = stage.get(`${id}|case:stage`)?.value;
    const domain = DOMAIN[a]; if (!domain) fail(`${id}: 영역을 모름(${a})`);
    const tier = TIER[st]; if (!tier) fail(`${id}: 단계를 모름(${st})`);
    if (!r.title || !r.description) fail(`${id}: 제목/설명이 비어 있음`);
    const thId = th?.theory_id && theories.has(th.theory_id) ? th.theory_id : null;
    if (th?.theory_id && !thId) warn.push(`${id}(이론 ${th.theory_id} 없음)`);
    const coId = th?.concept_id && concepts.has(th.concept_id) ? th.concept_id : null;
    newPrac.push({
      id, domain, category: CAT_BY_FORMAT[sz?.format] ?? "생각 다시 보기", tier, title: r.title, detail: r.description, origin: "CSO_2026_11",
      secondary_domains: a === "공통" ? ALL_SECONDARY : [], availability: "general", exposure_flag: false, exposure_step: null,
      coping_fit: stage.get(`${id}|case:coping_dir`)?.value ?? null, concept_id: coId, suggest_reason: null, source_theory_id: thId, source_technique: null,
    });
    const partner = yes(sz?.needs_partner), child = yes(sz?.needs_care), work = yes(sz?.needs_work), other = yes(sz?.needs_other);
    newElig.push({
      practice_id: id, audience_mode: partner ? "COUPLE" : child ? "PARENT" : work ? "WORK" : other ? "REL" : "SELF",
      requires_partner: partner, requires_childcare: child, requires_work: work, requires_other_person: other, work_context: work ? "work" : "none",
      allowed_primary_activity: [], q4_value_codes: [], q5_hobby_codes: [], q6_weekend_codes: [], q7_focus_codes: [], q9_exclusion_codes: list(codes.get(id)?.exclude_q9),
      estimated_min_minutes: num(sz?.min_minutes), estimated_max_minutes: num(sz?.max_minutes), time_evidence: "editorial_estimate_not_user_tested",
      safety_tags: [], review_status: approved ? "APPROVED" : "DRAFT_HUMAN_APPROVAL_REQUIRED", review_note: `CSO 묶음 v2.40 · ${r._file}`,
    });
  } else {
    const c = cur.get(id), t = r.title?.trim(), d = r.description?.trim();
    if ((t && t !== c.title) || (d && d !== c.detail)) textUpd.push({ id, ...(t && t !== c.title ? { title: t, before_title: c.title } : {}), ...(d && d !== c.detail ? { detail: d, before_detail: c.detail } : {}) });
    if (approved && elig.get(id) === "DRAFT_HUMAN_APPROVAL_REQUIRED") approve.push(id);
  }
}
const prefixCount = (a) => a.reduce((o, x) => { const k = (x.id ?? x).replace(/-.*$/, ""); o[k] = (o[k] ?? 0) + 1; return o; }, {});
console.log("검사:", {
  파일: FILES.length, 해석DB_실천행: ref.size, 새로_넣을_실천: newPrac.length, 새_실천_접두: prefixCount(newPrac),
  제목바뀜: textUpd.filter((x) => x.title).length, 설명바뀜: textUpd.filter((x) => x.detail).length, 승인으로: approve.length,
});
if (warn.length) console.log("주의:", warn.slice(0, 8).join(", "));
if (!APPLY) { console.log("검사만 했습니다(DB 변경 없음). 넣으려면 --apply"); process.exit(0); }

const backup = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "docs", "백업_비공개", "practices_before_v240.json");
fs.mkdirSync(path.dirname(backup), { recursive: true });
fs.writeFileSync(backup, JSON.stringify({ text: textUpd.map((x) => ({ id: x.id, title: x.before_title, detail: x.before_detail })), approved: approve }, null, 1));
const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
for (const part of chunks(newPrac, 200)) { const { error } = await admin.from("wellness_practices").upsert(part, { onConflict: "id" }); if (error) fail("wellness_practices: " + error.message); }
for (const part of chunks(newElig, 200)) { const { error } = await admin.from("practice_eligibility").upsert(part, { onConflict: "practice_id" }); if (error) fail("practice_eligibility: " + error.message); }
const now = new Date().toISOString();
for (const x of textUpd) {
  const { error } = await admin.from("wellness_practices").update({ ...(x.title ? { title: x.title } : {}), ...(x.detail ? { detail: x.detail } : {}), updated_at: now }).eq("id", x.id);
  if (error) fail(`${x.id}: ${error.message}`);
}
for (const part of chunks(approve, 200)) { const { error } = await admin.from("practice_eligibility").update({ review_status: "APPROVED", review_note: "CSO 승인(2026-11-26) — 묶음 v2.40" }).in("practice_id", part); if (error) fail("승인: " + error.message); }
console.log(`✅ 새 실천 ${newPrac.length} · 글 바뀜 ${textUpd.length} · 승인 ${approve.length} · 예전 글 백업: docs/백업_비공개/practices_before_v240.json`);
