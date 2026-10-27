// CSO 개발 전달 묶음(2026-10-27)의 신규 이론 6개(JC·RT·BA·SE·GT·SDT)를 운영 이론 표에 넣는다.
//   python3 scripts/cso_practices_to_json.py <03_실천 폴더> <json> --theories   →   node --env-file=.env.local scripts/import_cso_theories.mjs <json> [--apply]
// 기본은 검사만(DB에 쓰지 않음). --apply를 붙여야 넣는다. 모두 upsert(같은 ID는 덮어씀)라 여러 번 실행해도 안전하다. 기존 이론 14개는 건드리지 않는다.
//
// ⚠ 검수 상태: 원본이 전부 "초안(사람 승인 필요)"(2차 문헌 기반, 상담심리학자 검수 전)이라 **DRAFT로 넣는다.** 앱의 이론 선택(selectTheory)·질문·판별 문장 검색은 APPROVED만 쓰므로
//   이 6개 이론은 대화에서 아직 쓰이지 않는다(실천·뿌리 연결 데이터의 FK를 채우는 용도). 검수가 끝나면 --approve-theories <검수자> <검수일> 로 APPROVED로 바꾼다.
// 원본 열 중 DB에 칸이 없는 것(질문의 하위 단계·질문 형식·보기·답변별 다음, 개념의 층위·상위 개념·하위 과정, 기법의 적용 제외 조건, 판별 문장의 개념 ID, 이론의 범위 규칙)은 넣지 않는다 — 열 추가가 필요하면 별도 결정.
// 순서: 이론 → 개념 → 기법 → 질문 → 판별 문장(+임베딩) → (실천은 import_cso_practices.mjs) → 이론↔실천 연결 → 평가 문장.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const args = process.argv.slice(2);
const jsonPath = args.find((a) => !a.startsWith("--") && !(args[args.indexOf(a) - 1] ?? "").startsWith("--approve"));
const APPLY = args.includes("--apply");
const ai = args.indexOf("--approve-theories");
const fail = (m) => { console.error("❌ " + m); process.exit(1); };
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const NEW = ["TH-JC", "TH-RT", "TH-BA", "TH-SE", "TH-GT", "TH-SDT"];

if (ai >= 0) { // 검수 완료 처리(나중에): 6개 이론과 딸린 개념·기법·질문·판별 문장·연결을 APPROVED로
  const who = args[ai + 1], when = args[ai + 2];
  if (!who || !when) fail('사용법: --approve-theories "<검수자>" <YYYY-MM-DD>');
  const at = new Date(when + "T00:00:00+09:00").toISOString();
  for (const t of ["counseling_theories", "theory_concepts", "theory_techniques", "theory_questions", "theory_signals"]) {
    const col = t === "counseling_theories" ? "theory_id" : "theory_id";
    const { error } = await admin.from(t).update({ review_status: "APPROVED", reviewed_by: who, reviewed_at: at }).in(col, NEW);
    if (error) fail(`${t} 검수 완료 처리 실패: ${error.message}`);
  }
  const { error } = await admin.from("theory_practice_links").update({ review_status: "APPROVED" }).in("theory_id", NEW);
  if (error) fail("연결 검수 완료 처리 실패: " + error.message);
  console.log(`✅ 신규 이론 6개를 검수 완료(APPROVED)로 바꿨습니다 — ${who} ${when}`); process.exit(0);
}
if (!jsonPath) fail("사용법: node --env-file=.env.local scripts/import_cso_theories.mjs <json> [--apply]");
const D = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

const split = (v) => String(v ?? "").split(" · ").map((s) => s.trim()).filter(Boolean);
const nul = (v) => (v === "" || v == null ? null : v);
const int = (v) => (v === "" || v == null ? null : Number(v));
const STAGE = { 열기: "OPEN", 좁히기: "CLARIFY", "새 관점": "REFRAME", 마무리: "COMMIT" };
const COMPAT = { "잘 맞음": "fit", 보통: "neutral", "충돌(권하지 않음)": "conflict" };
const status = () => "DRAFT"; // 원본은 전부 "초안(사람 승인 필요)"

function voiceCard(txt) { // 원본은 {"question_style":..,"vocab":[..],"stance":..,"forbidden":[..]} 문자열 — 운영 14개 이론과 같은 모양(vocab·forbidden은 한 문자열)으로
  if (!txt) return null;
  const o = JSON.parse(txt);
  return { question_style: o.question_style ?? "", vocab: Array.isArray(o.vocab) ? o.vocab.join(", ") : (o.vocab ?? ""), stance: o.stance ?? "", forbidden: Array.isArray(o.forbidden) ? o.forbidden.join(" / ") : (o.forbidden ?? "") };
}
const theories = D.theories.map((r) => ({
  theory_id: r["이론 ID"], internal_name: r["내부 이름"], plain_focus: r["쉬운 한 줄 설명(AI가 이론을 고를 때 봄)"], allowed_routes: split(r["쓸 수 있는 대화 종류"]), exclude_conditions: split(r["제외 조건"]),
  max_explore_turns: int(r["탐색 최대 턴"]), clinical_sensitive: r["임상 민감"] === "예", review_status: status(), name_en: nul(r["영문 이름"]), lineage: nul(r["계보"]), founders: nul(r["창시자"]), source_book: nul(r["출처 책"]),
  service_role: nul(r["서비스 역할"]), domain_rank1: nul(r["영역 1순위"]), domain_rank2: nul(r["영역 2순위"]), domain_rank3: nul(r["영역 3순위"]), theory_axes: nul(r["핵심 축"]), prefer_other_when: nul(r["다른 이론이 더 맞을 때"]),
  persona_flag: nul(r["유형 연결"]), voice_card: voiceCard(r["말투 카드(질문 방식·어휘·자세·금지 표현)"]), explore_turns_typical_min: int(r["탐색 보통 최소 턴"]), explore_turns_typical_max: int(r["탐색 보통 최대 턴"]),
  parenting_note: nul(r["육아 메모"]), review_notes: nul(r["검수 메모"]),
}));
const concepts = D.concepts.map((r) => ({ concept_id: r["개념 ID"], theory_id: r["이론"], name_ko: r["이름"], name_en: nul(r["영문"]), definition: nul(r["정의(전문 용어)"]), plain_language: nul(r["쉬운 말 설명"]), growth_frame: nul(r["성장 프레임(사용자에게 풀어 주는 새 관점)"]), domains_note: nul(r["영역 메모"]), domains_ranked: nul(r["영역 순위"]), review_status: status() }));
const techniques = D.techniques.map((r) => ({ technique_id: r["기법 ID"], theory_id: r["이론"], number: nul(r["번호"]), name: r["이름"], sub_process: nul(r["하위 과정"]), domains_ranked: nul(r["영역 순위"]), timing: nul(r["쓰는 때"]), purpose: nul(r["목적"]), guidance_level: r["안내 수준"], steps: nul(r["단계"]), common_mistake: nul(r["흔한 실수"]), homework: nul(r["과제"]), ui_idea: nul(r["화면 아이디어"]), exposure_candidate: nul(r["불편 머무르기 후보"]), example_utterances: nul(r["예시 문장"]), linked_practices: nul(r["연결된 실천"]), main_concept_id: nul(r["대표 개념"]), review_status: status() }));
const questions = D.questions.map((r) => ({
  question_id: r["질문 ID"], theory_id: r["이론"], stage: STAGE[r["단계"]], question_text: r["채팅에 나가는 질문(원문 그대로)"], intent: nul(r["질문의 의도"]), use_when: nul(r["쓰는 때"]), issue_tags: split(r["고민 태그"]), do_not_apply_when: split(r["쓰면 안 되는 때"]),
  order_in_stage: int(r["단계 안 순서"]), review_status: status(), source: nul(r["출처"]), technique_id: nul(r["연결 기법"]), sub_process: nul(r["하위 과정"]), question_text_original: nul(r["원래 질문"]), chat_enabled: r["채팅 사용"] === "예",
  modify_note: nul(r["수정 사유"]), concept_id: nul(r["연결 개념"]), why_ask: nul(r["묻는 이유"]), growth_direction: nul(r["이어질 방향"]),
}));
const signals = D.signals.map((r) => ({ signal_id: r["문장 ID"], theory_id: r["이론"], sub_process: nul(r["하위 과정"]), domain: nul(r["영역"]), situation: nul(r["상황"]), form: nul(r["형식"]), length_class: nul(r["길이"]), utterance: r["사용자 말투 예시 문장"], reflection_text: nul(r["공감 문장(짐작형)"]), reflection_ok: nul(r["공감 사용 가능"]), memo: nul(r["메모·경계"]), negative_type: nul(r["부정 발언 유형"]), negative_response: nul(r["북돋움 응답"]), review_status: status() }));
const links = D.links.map((r) => ({ theory_id: r["이론"], concept_or_technique: nul(r["개념·기법"]), practice_id: r["실천 ID"], compatibility: COMPAT[r["궁합"]], relation: r["관계 설명"] === "—" ? null : nul(r["관계 설명"]), basis: nul(r["근거"]), review_status: status() }));
const evalSet = D.eval.map((r) => ({ eval_id: r["번호"], utterance: r["문장"], expected_label: r["정답(재판정 반영)"], written_by: nul(r["작성"]) }));

// ───── 검사
const tIds = new Set(theories.map((t) => t.theory_id)), cIds = new Set(concepts.map((c) => c.concept_id)), teIds = new Set(techniques.map((t) => t.technique_id));
for (const id of tIds) if (!NEW.includes(id)) fail(`예상 밖 이론 ${id}`);
const bad = [];
for (const c of concepts) if (!tIds.has(c.theory_id)) bad.push(`개념 ${c.concept_id}: 이론 없음`);
for (const t of techniques) { if (!tIds.has(t.theory_id)) bad.push(`기법 ${t.technique_id}: 이론 없음`); if (!["chatbot_ok", "facilitator_only", "excluded"].includes(t.guidance_level)) bad.push(`기법 ${t.technique_id}: 안내 수준 ${t.guidance_level}`); }
for (const q of questions) { if (!q.stage) bad.push(`질문 ${q.question_id}: 단계 값 모름`); if (!tIds.has(q.theory_id)) bad.push(`질문 ${q.question_id}: 이론 없음`); if (q.concept_id && !cIds.has(q.concept_id)) bad.push(`질문 ${q.question_id}: 개념 ${q.concept_id} 없음`); if (q.technique_id && !teIds.has(q.technique_id)) bad.push(`질문 ${q.question_id}: 기법 ${q.technique_id} 없음`); }
for (const s of signals) if (!tIds.has(s.theory_id)) bad.push(`판별 문장 ${s.signal_id}: 이론 없음`);
for (const l of links) if (!l.compatibility) bad.push(`연결 ${l.practice_id}: 궁합 값 모름`);
for (const [n, arr, k] of [["이론", theories, "theory_id"], ["개념", concepts, "concept_id"], ["기법", techniques, "technique_id"], ["질문", questions, "question_id"], ["판별 문장", signals, "signal_id"], ["평가 문장", evalSet, "eval_id"]]) if (new Set(arr.map((x) => x[k])).size !== arr.length) bad.push(`${n} ID 중복`);
if (bad.length) { bad.slice(0, 20).forEach((b) => console.error("  ✗", b)); fail(`검사 실패 ${bad.length}건`); }
// 열 이름 오타로 값이 조용히 비는 것을 막는다: 표마다 "거의 항상 채워져 있어야 하는 칸"이 비어 있는 행 수를 센다.
const emptyCount = (rows, cols) => Object.fromEntries(cols.map((c) => [c, rows.filter((r) => r[c] == null || r[c] === "" || (Array.isArray(r[c]) && !r[c].length)).length]));
const must = { 이론: [theories, ["plain_focus", "allowed_routes", "max_explore_turns", "voice_card"]], 개념: [concepts, ["name_ko", "definition", "plain_language", "growth_frame"]], 기법: [techniques, ["name", "purpose", "steps", "guidance_level"]], 질문: [questions, ["question_text", "intent", "why_ask", "growth_direction"]], 판별문장: [signals, ["utterance", "reflection_text", "domain"]] };
for (const [n, [rows, cols]] of Object.entries(must)) { const e = emptyCount(rows, cols); console.log(`  비어 있는 칸(${n} ${rows.length}행):`, e); if (cols.slice(0, 1).some((c) => e[c] === rows.length)) fail(`${n}: 핵심 칸 "${cols[0]}"가 전부 비었습니다 — 열 이름이 원본과 맞는지 확인`); }
const { data: existing } = await admin.from("counseling_theories").select("theory_id").in("theory_id", NEW);
console.log("검사 통과:", { 이론: theories.length, 개념: concepts.length, 기법: techniques.length, 질문: questions.length, 판별문장: signals.length, 연결: links.length, 평가문장: evalSet.length, 이미_있는_신규_이론: (existing ?? []).length });
if (!APPLY) { console.log("검사만 했습니다(DB 변경 없음). 넣으려면 --apply 를 붙이세요. (상태는 DRAFT — 앱 대화에는 아직 쓰이지 않음)"); process.exit(0); }

const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
async function upsert(table, rows, onConflict) { for (const part of chunks(rows, 100)) { const { error } = await admin.from(table).upsert(part, { onConflict }); if (error) fail(`${table} 저장 실패: ${error.message}`); } console.log(`  ${table}: ${rows.length}행 저장`); }
await upsert("counseling_theories", theories, "theory_id");
await upsert("theory_concepts", concepts, "concept_id");
await upsert("theory_techniques", techniques, "technique_id");
await upsert("theory_questions", questions, "question_id");
const openai = new OpenAI(); const emb = [];
for (const part of chunks(signals, 100)) { const res = await openai.embeddings.create({ model: "text-embedding-3-small", input: part.map((s) => s.utterance), encoding_format: "float" }); emb.push(...res.data.map((d) => d.embedding)); }
await upsert("theory_signals", signals.map((s, i) => ({ ...s, embedding: JSON.stringify(emb[i]) })), "signal_id");
await upsert("matching_eval_set", evalSet, "eval_id");
// 이론↔실천 연결은 실천(THX-*)이 들어간 뒤에만 넣을 수 있다(FK). 실천이 아직 없으면 건너뛰고 알려 준다.
const { data: have } = await admin.from("wellness_practices").select("id").in("id", [...new Set(links.map((l) => l.practice_id))]);
const haveSet = new Set((have ?? []).map((r) => r.id));
const ok = links.filter((l) => haveSet.has(l.practice_id));
if (ok.length) {
  const { error: de } = await admin.from("theory_practice_links").delete().in("theory_id", NEW); if (de) fail("연결 삭제 실패: " + de.message);
  for (const part of chunks(ok, 100)) { const { error } = await admin.from("theory_practice_links").insert(part); if (error) fail("연결 저장 실패: " + error.message); }
}
console.log(`  theory_practice_links: ${ok.length}/${links.length}행 저장${ok.length < links.length ? " — 나머지는 실천(THX-*)을 넣은 뒤 이 스크립트를 다시 실행" : ""}`);
console.log("✅ 완료(상태 DRAFT)");
