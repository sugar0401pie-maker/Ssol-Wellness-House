// 이론 선택 AI의 프롬프트 방식 비교: (A) 이론 설명만 / (B) 판별 예시 문장을 이론마다 몇 개씩 예시로 넣기. owner 재판정 라벨로 채점한다. DB에는 쓰지 않는다.
//   node --env-file=.env.local scripts/theory_select_variants_eval.mjs <graded.json> <모델> [예시수=3]
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import fs from "node:fs";
import { buildSelectPrompt, parseTheoryAnswer } from "../lib/theory/theoryAnswer.ts";

const graded = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"));
const MODEL = process.argv[3], K = Number(process.argv[4] ?? 3);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const openai = new OpenAI({ timeout: 40000, maxRetries: 2 });
const { data: th } = await admin.from("counseling_theories").select("theory_id, plain_focus, theory_axes, allowed_routes, clinical_sensitive").eq("review_status", "APPROVED").order("theory_id");
const rows = th.filter((t) => !t.clinical_sensitive && t.allowed_routes.includes("wellness"));
const ids = rows.map((t) => t.theory_id.replace("TH-", ""));
const base = buildSelectPrompt(rows.map((t) => ({ id: t.theory_id.replace("TH-", ""), focus: t.plain_focus, axes: t.theory_axes })));
// 예시: 이번 추가분(…-S16 이상) 중 "경계"→"고유표현"→"요청형" 순으로 이론당 K개
const { data: sig } = await admin.from("theory_signals").select("signal_id, theory_id, utterance, memo").order("signal_id");
const pri = (m) => (m?.includes("[경계") ? 0 : m?.includes("[고유표현") ? 1 : m?.includes("[요청형") ? 2 : 3);
const ex = {};
for (const t of ids) ex[t] = sig.filter((s) => s.theory_id === "TH-" + t && Number(s.signal_id.split("-S")[1]) >= 16).sort((a, b) => pri(a.memo) - pri(b.memo) || a.signal_id.localeCompare(b.signal_id)).slice(0, K);
const fewshot = base + "\n\n[이론별 예시 문장 — 이런 말에는 해당 이론이 맞습니다. 문장이 예시와 달라도 뜻이 비슷하면 같은 이론으로 보세요.]\n" + ids.map((t) => ex[t].map((s) => `- ${s.utterance} → ${t}`).join("\n")).join("\n");

async function pick(system, text) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await openai.responses.create({ model: MODEL, input: [{ role: "system", content: system }, { role: "user", content: text }], max_output_tokens: 400 });
      return { id: parseTheoryAnswer((r.output_text ?? "").trim(), ids), tok: r.usage?.input_tokens ?? 0 };
    } catch { await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  return { id: undefined, tok: 0 };
}
async function run(system) {
  const res = new Array(graded.length); let next = 0, tok = 0;
  await Promise.all(Array.from({ length: 5 }, async () => { while (next < graded.length) { const i = next++; const p = await pick(system, graded[i].text); res[i] = p.id; tok += p.tok; } }));
  let theoryRows = 0, hit = 0, picks = 0, right = 0, noneRows = 0, noneOk = 0, errs = 0; const wrong = [];
  graded.forEach((g, i) => {
    const p = res[i]; if (p === undefined) { errs++; return; }
    if (g.none) { noneRows++; if (!p) noneOk++; if (p) picks++; return; }
    const al = g.allowed.filter((t) => ids.includes(t)); if (!al.length) return; // 정답 이론이 후보에 없으면 채점 제외
    theoryRows++; if (p) { picks++; if (al.includes(p)) { hit++; right++; } else wrong.push(`${g.id}: ${p} (정답 ${al.join("/")})`); } else wrong.push(`${g.id}: 못 고름 (정답 ${al.join("/")})`);
  });
  return { 정답률: `${hit}/${theoryRows} = ${(100 * hit / theoryRows).toFixed(1)}%`, 정밀도: `${right}/${picks} = ${(100 * right / picks).toFixed(1)}%`, 고르면안되는문장을안고름: `${noneOk}/${noneRows}`, 오류: errs, 평균입력토큰: Math.round(tok / graded.length), wrong };
}
const A = await run(base), B = await run(fewshot);
console.log(`모델 ${MODEL} · 채점 ${graded.length}문장`);
console.log("(A) 이론 설명만   ", { ...A, wrong: undefined });
console.log("(B) +예시 문장", K, "개/이론", { ...B, wrong: undefined });
console.log("A 틀린 것:", A.wrong.join(" | "));
console.log("B 틀린 것:", B.wrong.join(" | "));
