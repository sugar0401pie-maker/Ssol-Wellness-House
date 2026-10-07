// AI 이론 선택(lib/theory/selectTheory.ts와 같은 프롬프트)을 matching_eval_set 문장에 돌려서, 맞음/틀림을 표시한 표(CSV)를 만든다. DB에는 쓰지 않는다.
//   node --env-file=.env.local scripts/theory_llm_select_eval.mjs <출력.csv> [모델]
// 정답 라벨은 사람이 쓴 자유 문장이라 라벨 안에 나오는 이론 약어를 모두 "허용 이론"으로 본다(theory_match_eval.mjs와 같은 규칙).
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { writeFileSync } from "node:fs";
import { buildSelectPrompt, parseTheoryAnswer } from "../lib/theory/theoryAnswer.ts";

const out = process.argv[2] || "theory_llm_select_eval.csv";
const MODEL = process.argv[3] || process.env.THEORY_SELECT_MODEL || process.env.CHAT_MODEL || "gpt-5.6-luna";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const openai = new OpenAI({ timeout: 30000, maxRetries: 2 });
const ALL = ["ACT", "CFT", "DBT", "CBT", "REBT", "RBT", "ST", "LTA", "IPT", "WBT", "PPT", "EFT", "LOGO", "MCP"];

const { data: evals } = await admin.from("matching_eval_set").select("*").order("eval_id");
const { data: th } = await admin.from("counseling_theories").select("theory_id, plain_focus, theory_axes, allowed_routes, clinical_sensitive").eq("review_status", "APPROVED").order("theory_id");
const rows = th.filter((t) => !t.clinical_sensitive && t.allowed_routes.includes("wellness"));
const ids = rows.map((t) => t.theory_id.replace("TH-", ""));
const system = buildSelectPrompt(rows.map((t) => ({ id: t.theory_id.replace("TH-", ""), focus: t.plain_focus, axes: t.theory_axes })));

const allowed = (label) => new Set(ALL.filter((t) => new RegExp(`(^|[^A-Za-z])(TH-)?${t}([^A-Za-z]|$)`).test(label)));
const isNone = (label) => /^해당 없음|매칭 보류|^안전 라우터/.test(label);

async function pick(text) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await openai.responses.create({ model: MODEL, input: [{ role: "system", content: system }, { role: "user", content: text }], max_output_tokens: 300 });
      return { id: parseTheoryAnswer((r.output_text ?? "").trim(), ids), tokens: r.usage?.input_tokens ?? 0 };
    } catch (e) { await new Promise((r) => setTimeout(r, 1500 * (t + 1))); }
  }
  return { id: undefined, tokens: 0 };
}

const results = new Array(evals.length);
let next = 0;
await Promise.all(Array.from({ length: 5 }, async () => {
  while (next < evals.length) {
    const i = next++; const e = evals[i];
    const p = await pick(e.utterance);
    const exp = allowed(e.expected_label); const none = isNone(e.expected_label);
    const pickedId = p.id;
    let verdict;
    if (pickedId === undefined) verdict = "오류(재시도 실패)";
    else if (none) verdict = pickedId ? "틀림: 고르면 안 되는 문장인데 골랐음" : "맞음(안 고름)";
    else if (exp.size === 0) verdict = "라벨 애매(채점 제외)";
    else if (![...exp].some((t) => ids.includes(t))) verdict = pickedId ? "채점 제외: 정답 이론이 선택 후보에 없음(" + [...exp].join("/") + ")" : "채점 제외: 정답 이론이 후보에 없고 안 고름";
    else if (!pickedId) verdict = "틀림: 못 골랐음(NONE)";
    else verdict = exp.has(pickedId) ? "맞음" : "틀림: 다른 이론을 골랐음";
    results[i] = { id: e.eval_id, utterance: e.utterance, expected: e.expected_label, picked: pickedId ? "TH-" + pickedId : pickedId === null ? "(없음)" : "(오류)", verdict };
  }
}));

const wrong = results.filter((r) => r.verdict.startsWith("틀림"));
const graded = results.filter((r) => r.verdict.startsWith("맞음") || r.verdict.startsWith("틀림"));
const withTheory = graded.filter((r) => !r.verdict.includes("안 고름") && !r.verdict.includes("고르면 안 되는"));
const picked = graded.filter((r) => r.picked.startsWith("TH-"));
const rightPicked = picked.filter((r) => r.verdict === "맞음");
console.log(`모델 ${MODEL} · 평가 ${results.length}개, 채점 ${graded.length}개, 틀림 ${wrong.length}개`);
console.log(`정답률(이론이 정답인 문장 중 맞게 고름): ${results.filter((r) => r.verdict === "맞음").length}/${results.filter((r) => r.verdict === "맞음" || r.verdict.startsWith("틀림: 다른") || r.verdict.startsWith("틀림: 못")).length}`);
console.log(`정밀도(고른 것 중 맞음): ${rightPicked.length}/${picked.length}`);
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
writeFileSync(out, "﻿" + ["번호,문장,사람이 적은 정답,AI가 고른 이론,채점", ...results.map((r) => [r.id, q(r.utterance), q(r.expected), r.picked, q(r.verdict)].join(","))].join("\n"));
console.log("저장:", out);
// 틀린 것만 한 줄씩
for (const r of wrong) console.log(`✗ ${r.id} | ${r.utterance.slice(0, 50)} | 정답: ${r.expected.slice(0, 40)} | 고른 것: ${r.picked} | ${r.verdict.slice(0, 20)}`);
