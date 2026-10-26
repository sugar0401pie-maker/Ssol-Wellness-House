// 읽기 전용 점검(2026-10-20): 새 버전 CSV로도 우리 변환 코드(카드·클레임·테스트 단서·가르기 질문·뿌리 문장)가 같은 결과를 내는지 본다. DB 형식(불리언·숫자·JSON)으로 바꿔서 읽는다.
//   node scripts/sw_check_converters.mjs <CSV 폴더> <새 10_sw_reference_tables_v*.sql>
import fs from "node:fs"; import path from "node:path"; import assert from "node:assert/strict";
import { parseCsv } from "./sw_csv.mjs";
import { buildCardData } from "../lib/cards/data.ts";
import { buildClaims } from "../lib/interp/claims.ts";
import { buildCues, buildBands, TEST_DOMAINS, TEST_PAIRS } from "../lib/interp/testInput.ts";
import { buildDiscGroups, buildRootTexts } from "../lib/interp/speak.ts";
const DIR = process.argv[2], SQLF = process.argv[3];
// 실제 적재 경로와 같게: CSV 글자를 표 정의(v1.9 SQL)의 형식으로 바꿔서(loader의 convert와 같은 규칙) 읽는다 — DB에서 읽은 값과 같은 모양
const sqlText = fs.readFileSync(SQLF, "utf8"); const TYPES = {};
for (const m of sqlText.matchAll(/create table if not exists public\.(sw_ob_\w+) \(\n([\s\S]*?)\n\);/g)) { TYPES[m[1]] = {}; for (const line of m[2].split("\n")) { const c = line.match(/^\s{2}(\w+) (text|jsonb|integer|numeric|boolean|timestamptz|uuid|bigint)\b/); if (c) TYPES[m[1]][c[1]] = c[2]; } }
const conv = (v, ty) => { if (v === null) return null; if (ty === "integer" || ty === "bigint" || ty === "numeric") return Number(v); if (ty === "boolean") return ["true", "t", "1"].includes(String(v).toLowerCase()); if (ty === "jsonb") return JSON.parse(v); return v; };
const rows = (t) => { const r = parseCsv(fs.readFileSync(path.join(DIR, t + ".csv"), "utf8").replace(/^\ufeff/, "")).filter((x) => !(x.length === 1 && x[0] === null)); const h = r.shift(); return r.map((x) => Object.fromEntries(h.map((k, i) => [k, conv(x[i], TYPES[t]?.[k])]))); };
let bad = 0; const ok = (c, m) => { console.log(`${c ? "✅" : "❌"} ${m}`); if (!c) bad++; };
// 1) 카드 데이터: 새 CSV로 만든 결과 = 저장소 보관본(CSO v0.4 JSON) — 데이터 표현(문자열 "True" 등)이 달라도 같은 결과여야 한다
const card = buildCardData({ scenes: rows("sw_ob_choice_scenes"), cards: rows("sw_ob_choice_cards"), options: rows("sw_ob_choice_options"), fixed: rows("sw_ob_choice_cards_fixed"), confirm: rows("sw_ob_choice_confirm"), practices: rows("sw_ob_choice_practice_candidates") });
const fx = JSON.parse(fs.readFileSync(new URL("../lib/cards/__fixtures__/choice_cards_fixture.json", import.meta.url), "utf8"));
const norm = (d) => JSON.parse(JSON.stringify(d, (k, v) => (k === "candidates" ? [...v].sort((a, b) => a.practice_id.localeCompare(b.practice_id)).map((c) => ({ ...c, auto_expose: c.auto_expose === true || c.auto_expose === "True" || c.auto_expose === "true" })) : v)));
for (const k of ["cards", "options", "confirm"]) { try { assert.deepEqual(norm(card[k]), norm(fx[k])); ok(true, `카드 ${k} = 보관본`); } catch (e) { ok(false, `카드 ${k} 다름: ${String(e.message).split("\n").slice(0, 6).join(" | ").slice(0, 300)}`); } }
// 2) 클레임
const cl = buildClaims(rows("sw_ob_claims"), rows("sw_ob_claim_roots"), rows("sw_ob_choice_options"), rows("sw_ob_roots"));
ok(cl.length === 315 && cl.every((c) => typeof c.generic === "undefined" || c.generic === true), `클레임 ${cl.length}개 변환(generic 표기 정상)`);
// 3) 테스트 단서·구간·영역·짝
const cues = buildCues(rows("sw_ob_test_root_cues")); const bands = buildBands(rows("sw_ob_test_bands"));
ok(cues.length === 151 && bands.length === 7, `테스트 단서 ${cues.length}개 · 구간 ${bands.length}개`);
const dom = {}; for (const r of rows("sw_ob_test_domains").sort((a, b) => Number(a.ord) - Number(b.ord))) (dom[r.domain] ??= []).push(r.factor);
ok(JSON.stringify(dom) === JSON.stringify(TEST_DOMAINS), "영역↔요인 표 = 우리 상수(TEST_DOMAINS)");
ok(JSON.stringify(rows("sw_ob_test_root_pairs").map((r) => [r.root_a, r.root_b])) === JSON.stringify(TEST_PAIRS), "짝 뿌리 = 우리 상수(TEST_PAIRS)");
ok(rows("sw_ob_test_root_cues").every((r) => r.instrument === "dessert_v2"), "단서 전부 instrument=dessert_v2");
// 4) 가르기 질문·뿌리 문장
const dg = buildDiscGroups(rows("sw_ob_root_discriminators")); ok(dg.length === 27, `가르기 질문 ${dg.length}개 변환`);
const rt = buildRootTexts(rows("sw_ob_root_texts"), rows("sw_ob_roots")); ok(Object.keys(rt).length === 106 && Object.values(rt).some((t) => t.sensitive) && Object.values(rt).every((t) => typeof t.sensitive === "boolean"), `뿌리 문장 106개(민감 표시 ${Object.values(rt).filter((t) => t.sensitive).length}개)`);
if (process.env.DBG) { console.log("TYPES root_texts", TYPES["sw_ob_root_texts"]); const rr = rows("sw_ob_root_texts"); console.log("sample", Object.entries(rr[0]).map(([k, v]) => k + "=" + typeof v + ":" + String(v).slice(0, 20))); console.log("민감 true 수", rr.filter((x) => x.sensitive === true).length); }
console.log(bad ? `\n문제 ${bad}건` : "\n전부 정상"); process.exit(bad ? 1 : 0);
