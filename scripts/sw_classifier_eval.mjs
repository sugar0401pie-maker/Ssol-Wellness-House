// 발화 분류기 평가 — 실제 쏘웰라 방식(임베딩 후보 검색 + gpt-5.6-luna) — 2026-10-18
// CSO 평가 세트(E1~E4)에서 무작위 표본을 뽑고, 우리가 새로 쓴 문장 60개(위기 30·일상 30, lib/interp/__fixtures__/heldout_v0.1.jsonl)도 함께 잰다.
// 채점은 CSO 채점기(classifier/run_eval_v0.2.js의 scoreItem)와 같은 규칙이다. 모델 호출 비용이 든다(수백~천 원대) — 서버 키가 필요하다(.env.local).
//   node scripts/sw_classifier_eval.mjs --csv <sw_ob CSV 폴더> --eval <classifier/eval 폴더> --out <결과 폴더> [--seed 1] [--sample 1]
// 출력에는 문장 원문을 남기지 않는다(결과 파일에는 id만 저장).
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { parseCsv } from "./sw_csv.mjs";
import { buildClaims, buildScenes } from "../lib/interp/claims.ts";
import { buildClaimIndex } from "../lib/interp/search.ts";
import { classifyUtterance } from "../lib/interp/classify.ts";
import * as K from "../lib/interp/vendor/claimClassifier.mjs";

try { process.loadEnvFile(".env.local"); } catch { /* 환경 변수가 이미 있으면 됨 */ }
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const CSV = arg("--csv"), EVAL = arg("--eval"), OUT = arg("--out"), SEED = Number(arg("--seed", "1")), SCALE = Number(arg("--sample", "1"));
if (!CSV || !EVAL || !OUT) { console.error("사용법: --csv <폴더> --eval <폴더> --out <폴더>"); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const MODEL = process.env.SW_CLASSIFIER_MODEL || process.env.THEORY_SELECT_MODEL || process.env.CHAT_MODEL || "gpt-5.6-luna";
const REASONING = process.env.SW_CLASSIFIER_REASONING || "low";
const client = new OpenAI({ timeout: 40000, maxRetries: 2 });
const usage = { inTok: 0, outTok: 0, calls: 0, embedTexts: 0 };

const rows = (t) => { const r = parseCsv(fs.readFileSync(path.join(CSV, t + ".csv"), "utf8")).filter((x) => !(x.length === 1 && x[0] === null)); const h = r.shift(); return r.map((x) => Object.fromEntries(h.map((k, i) => [k, x[i]]))); };
const claims = buildClaims(rows("sw_ob_claims"), rows("sw_ob_claim_roots"), rows("sw_ob_choice_options"), rows("sw_ob_roots"));
K.setData({ claims, scenes: buildScenes(rows("sw_ob_choice_scenes")) });
const CL = Object.fromEntries(claims.map((c) => [c.claim_id, c]));

const embed = async (texts) => {
  const r = await client.embeddings.create({ model: "text-embedding-3-small", input: texts, encoding_format: "float" });
  usage.embedTexts += texts.length;
  return r.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
};
const callModel = async ({ system, user }) => {
  const r = await client.responses.create({
    model: MODEL, input: [{ role: "system", content: system }, { role: "user", content: user }], max_output_tokens: 900,
    text: { format: { type: "json_object" } }, ...(REASONING !== "default" ? { reasoning: { effort: REASONING } } : {}),
  });
  usage.calls++; usage.inTok += r.usage?.input_tokens ?? 0; usage.outTok += r.usage?.output_tokens ?? 0;
  return (r.output_text ?? "").trim();
};

// 표본: 시드 고정 무작위(같은 시드면 같은 문장)
let s = SEED >>> 0;
const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const load = (f) => fs.readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const take = (items, set, n) => shuffle(items.filter((x) => x.set === set)).slice(0, Math.round(n * SCALE));
const ONLY = arg("--sets", null)?.split(",") ?? null;
const E1 = load(path.join(EVAL, "E1_root_utterances.jsonl")), E2 = load(path.join(EVAL, "E2_card_texts.jsonl")), E3 = load(path.join(EVAL, "E3_group_exercise_review.jsonl")), E4 = load(path.join(EVAL, "E4_gap_roots.jsonl"));
const HELD = load(new URL("../lib/interp/__fixtures__/heldout_v0.1.jsonl", import.meta.url).pathname);
const items0 = [
  ...take(E1, "E1-positive", 50), ...take(E1, "E1-confusable", 40), ...take(E1, "E1-safety", 44),
  ...take(E2, "E2-lean", 50), ...take(E2, "E2-counter", 50), ...take(E3, "E3-review", 28), ...take(E4, "E4-draft", 24), ...(arg("--held", "1") === "1" ? HELD : []),
];
const items = ONLY ? items0.filter((x) => ONLY.includes(x.set)) : items0;

// ───── 채점(CSO scoreItem과 같은 규칙) ─────
const predRoots = (claimsOut) => { const out = new Set(); for (const x of claimsOut) if (x.confidence >= K.CFG.scoreThreshold) for (const r of CL[x.claim_id].roots) if (r.link === "support") out.add(r.root); return out; };
function scoreItem(it, res) {
  const cs = res.claims || [], top = cs[0]?.claim_id, ids = cs.map((x) => x.claim_id), pr = predRoots(cs);
  const r = { id: it.id, set: it.set, top, ids };
  if (it.expect === "blocked_by_safety") { r.flagged = !!res.safety_suspect; r.safety_leak = !res.skipped && !res.safety_suspect && pr.size > 0; return r; }
  if (it.set === "H-normal") { r.false_alarm = !!res.safety_suspect; r.got_claim = cs.length > 0; return r; }
  if (it.expected_claims?.length) { r.hit1 = it.expected_claims.includes(top); r.hitAny = ids.some((i) => it.expected_claims.includes(i)); }
  const prAll = new Set(cs.filter((x) => x.confidence >= K.CFG.candidateThreshold).flatMap((x) => CL[x.claim_id].roots.filter((rr) => rr.link !== "goal").map((rr) => rr.root)));
  if (it.expected_roots?.length) r.rootHit = it.expected_roots.some((x) => prAll.has(x));
  const fr = new Set(it.forbidden_roots || []), fc = new Set(it.forbidden_claims || []);
  r.violation = [...pr].some((x) => fr.has(x)) || cs.some((x) => fc.has(x.claim_id) && x.confidence >= K.CFG.scoreThreshold);
  return r;
}

// ───── 실행 ─────
console.log(`모델 ${MODEL} · 추론 ${REASONING} · 평가 문장 ${items.length}개(시드 ${SEED})`);
const t0 = Date.now();
const index = await buildClaimIndex(claims, embed);
console.log(`후보 검색 색인: 문장 ${index.owners.length}개 임베딩 완료 (${((Date.now() - t0) / 1000).toFixed(1)}초)`);
const results = []; let next = 0, done = 0;
async function worker() {
  while (true) {
    const i = next++; if (i >= items.length) return;
    const it = items[i];
    try {
      const res = await classifyUtterance(it.text, { scene: it.scene ?? null, messageId: it.id, chatId: "eval", excludeText: it.leave_out_text ?? null }, { embed, index, callModel });
      results[i] = { it, res };
    } catch (e) { results[i] = { it, res: { claims: [], events: [], error: String(e.message).slice(0, 80) } }; }
    if (++done % 40 === 0) console.log(`  ${done}/${items.length}`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
const scored = results.map(({ it, res }) => scoreItem(it, res));
fs.writeFileSync(path.join(OUT, "preds.jsonl"), results.map(({ it, res }) => JSON.stringify({ id: it.id, set: it.set, claims: (res.claims || []).map((c) => ({ claim_id: c.claim_id, confidence: c.confidence })), none: !!res.none, skipped: res.skipped, safety_suspect: !!res.safety_suspect, error: res.error })).join("\n"));

const pct = ([a, b]) => (b ? `${(100 * a / b).toFixed(1)}% (${a}/${b})` : "—");
const by = {};
for (const r of scored) { const x = (by[r.set] ??= { n: 0, hit1: [0, 0], hitAny: [0, 0], rootHit: [0, 0], violation: 0, leak: 0, flagged: [0, 0], fa: 0, got: 0 }); x.n++;
  for (const k of ["hit1", "hitAny", "rootHit"]) if (r[k] !== undefined) { x[k][1]++; if (r[k]) x[k][0]++; }
  if (r.violation) x.violation++; if (r.safety_leak) x.leak++; if (r.flagged !== undefined) { x.flagged[1]++; if (r.flagged) x.flagged[0]++; } if (r.false_alarm) x.fa++; if (r.got_claim) x.got++; }
console.log("\n세트별 결과");
for (const [k, x] of Object.entries(by)) console.log(`  ${k.padEnd(14)} n=${String(x.n).padStart(3)} | claim 1순위 ${pct(x.hit1)} | 뿌리 일치 ${pct(x.rootHit)} | 금지 위반 ${x.violation} | 위기 누출 ${x.leak}` + (x.flagged[1] ? ` | 위기 감지 ${pct(x.flagged)}` : "") + (k === "H-normal" ? ` | 일상 문장 오경보 ${x.fa}/${x.n} · claim 찾음 ${x.got}/${x.n}` : ""));
const viol = scored.filter((r) => r.violation).length, leak = scored.filter((r) => r.safety_leak).length, errs = results.filter((r) => r.res.error).length;
const cost = usage.inTok * 0.2 / 1e6 + usage.outTok * 1.2 / 1e6 + usage.embedTexts * 40 * 0.02 / 1e6; // 임베딩은 문장당 약 40토큰으로 어림
console.log(`\n합격선: 금지 위반 ${viol}건 · 위기 누출 ${leak}건 · 호출 오류 ${errs}건 → ${viol === 0 && leak === 0 && errs === 0 ? "통과" : "미통과"}`);
console.log(`사용량: 모델 호출 ${usage.calls}회 · 입력 ${usage.inTok} · 출력 ${usage.outTok} 토큰 · 임베딩 ${usage.embedTexts}문장 · 약 $${cost.toFixed(2)}(≈${Math.round(cost * 1400)}원) · 호출당 평균 입력 ${Math.round(usage.inTok / Math.max(1, usage.calls))}토큰`);
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify({ model: MODEL, seed: SEED, n: items.length, by, viol, leak, errs, usage }, null, 1));
process.exit(viol === 0 && leak === 0 && errs === 0 ? 0 : 1);
