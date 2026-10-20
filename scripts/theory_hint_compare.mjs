// 이론 구분 힌트(selectHints.ts) 확장 전후 비교(2026-10-19, 상담사 R7): 같은 평가 문장(matching_eval_set, 상담사 보정 정답)에 대해
// (기준) 현재 SELECT_SUFFIXES vs (후보) 확장안을 여러 번 돌려 정답률·정밀도를 본다. DB에는 쓰지 않는다.
//   node --env-file=.env.local scripts/theory_hint_compare.mjs [반복=3] [후보 json 경로]
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import fs from "node:fs";
import { buildSelectPrompt, parseTheoryAnswer } from "../lib/theory/theoryAnswer.ts";
import { applySelectSuffixes, SELECT_SUFFIXES } from "../lib/theory/selectHints.ts";

const REPEAT = Number(process.argv[2] ?? 3);
const CAND = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], "utf-8")) : null;
const MODEL = process.env.THEORY_SELECT_MODEL || process.env.CHAT_MODEL || "gpt-5.6-luna";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const openai = new OpenAI({ timeout: 40000, maxRetries: 2 });
const ALL = ["ACT", "CFT", "DBT", "CBT", "REBT", "RBT", "ST", "LTA", "IPT", "WBT", "PPT", "EFT", "LOGO", "MCP"];
const { data: evals } = await admin.from("matching_eval_set").select("eval_id,utterance,expected_label").order("eval_id");
const { data: th } = await admin.from("counseling_theories").select("theory_id, plain_focus, theory_axes, allowed_routes, clinical_sensitive").eq("review_status", "APPROVED").order("theory_id");
const rows = th.filter((t) => !t.clinical_sensitive && t.allowed_routes.includes("wellness"));
const ids = rows.map((t) => t.theory_id.replace("TH-", ""));
const list = rows.map((t) => ({ id: t.theory_id.replace("TH-", ""), focus: t.plain_focus, axes: t.theory_axes }));
const allowed = (label) => new Set(ALL.filter((t) => new RegExp(`(^|[^A-Za-z])(TH-)?${t}([^A-Za-z]|$)`).test(label)));
const isNone = (label) => /^해당 없음|매칭 보류|^안전 라우터/.test(label);
const graded = evals.map((e) => ({ id: e.eval_id, text: e.utterance, none: isNone(e.expected_label), allowed: [...allowed(e.expected_label)].filter((t) => ids.includes(t)) })).filter((g) => g.none || g.allowed.length);

async function pick(system, text) {
  for (let i = 0; i < 4; i++) {
    try { const r = await openai.responses.create({ model: MODEL, input: [{ role: "system", content: system }, { role: "user", content: text }], max_output_tokens: 600 }); return parseTheoryAnswer((r.output_text ?? "").trim(), ids); }
    catch { await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  return undefined;
}
async function run(system) {
  const res = new Array(graded.length); let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => { while (next < graded.length) { const i = next++; res[i] = await pick(system, graded[i].text); } }));
  let n = 0, hit = 0, picks = 0, right = 0, noneN = 0, noneOk = 0; const wrong = [];
  graded.forEach((g, i) => { const p = res[i]; if (p === undefined) return;
    if (g.none) { noneN++; if (!p) noneOk++; else picks++; return; }
    n++; if (p) { picks++; if (g.allowed.includes(p)) { hit++; right++; } else wrong.push(`${g.id}:${p}≠${g.allowed.join("/")}`); } else wrong.push(`${g.id}:못고름`); });
  return { hit, n, right, picks, noneOk, noneN, wrong };
}
const variants = { 기준: SELECT_SUFFIXES, ...(CAND ? { 후보: CAND } : {}) };
console.log(`모델 ${MODEL} · 채점 문장 ${graded.length}개 · 반복 ${REPEAT}`);
for (const [name, suf] of Object.entries(variants)) {
  const system = buildSelectPrompt(applySelectSuffixes(list, suf));
  const sum = { hit: 0, n: 0, right: 0, picks: 0, noneOk: 0, noneN: 0 }; const wrongCount = {};
  for (let r = 0; r < REPEAT; r++) { const t0 = Date.now(); const x = await run(system); console.log(`   (${name} ${r + 1}/${REPEAT}회 ${((Date.now() - t0) / 1000).toFixed(0)}초)`); for (const k of Object.keys(sum)) sum[k] += x[k]; x.wrong.forEach((w) => (wrongCount[w] = (wrongCount[w] ?? 0) + 1)); }
  console.log(`[${name}] 정답률 ${(100 * sum.hit / sum.n).toFixed(1)}% (${sum.hit}/${sum.n}) · 정밀도 ${(100 * sum.right / sum.picks).toFixed(1)}% (${sum.right}/${sum.picks}) · 고르면 안 되는 문장을 안 고름 ${sum.noneOk}/${sum.noneN}`);
  console.log("   자주 틀린 것:", Object.entries(wrongCount).filter(([, c]) => c >= Math.ceil(REPEAT / 2)).map(([w]) => w).join(" | "));
}
