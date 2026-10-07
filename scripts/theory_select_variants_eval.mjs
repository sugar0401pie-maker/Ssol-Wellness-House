// 이론 선택 AI의 프롬프트 방식 비교: (A) 이론 설명만 / (B) 판별 예시 문장을 이론마다 몇 개씩 예시로 넣기. owner 재판정 라벨로 채점한다. DB에는 쓰지 않는다.
//   node --env-file=.env.local scripts/theory_select_variants_eval.mjs <graded.json> <모델> [예시수=3] [반복=1]
// (C) 구분 단서(selectHints.ts)를 붙인 프롬프트도 함께 잰다. 반복>1이면 각 방식을 여러 번 돌려 모델 응답의 흔들림을 본다.
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import fs from "node:fs";
import { buildSelectPrompt, parseTheoryAnswer } from "../lib/theory/theoryAnswer.ts";
import { buildHintLines } from "../lib/theory/selectHints.ts";

const graded = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"));
const MODEL = process.argv[3], K = Number(process.argv[4] ?? 3), REPEAT = Number(process.argv[5] ?? 1);
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
      const r = await openai.responses.create({ model: MODEL, input: [{ role: "system", content: system }, { role: "user", content: text }], max_output_tokens: 600, ...(process.env.REASONING ? { reasoning: { effort: process.env.REASONING } } : {}) });
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
const hinted = buildSelectPrompt(rows.map((t) => ({ id: t.theory_id.replace("TH-", ""), focus: t.plain_focus, axes: t.theory_axes })), buildHintLines(ids));
// (D) 별도 문단 대신, 해당 이론 설명 줄 끝에 짧은 단서를 덧붙이는 방식
const SUFFIX = { EFT: "※ '내가 이 사람한테 중요한가'·위로가 안 닿음·싸운 뒤 멀어질까 무서움·다가가면 물러나는 되풀이", IPT: "※ 분담·기대 차이·역할 변화·새 상황 — 정서적 연결 단서가 없으면 연애여도 IPT", ACT: "※ 방향은 아는데 불안·생각이 올라오면 멈추거나 피함", LOGO: "※ 무엇이 의미인지 모름·속이 빈 느낌·나 밖을 향한 쓰임·유머로 부풀려 웃어넘기기" };
const suffixed = buildSelectPrompt(rows.map((t) => { const id = t.theory_id.replace("TH-", ""); return { id, focus: t.plain_focus + (SUFFIX[id] ? " " + SUFFIX[id] : ""), axes: t.theory_axes }; }));
const out = {};
for (let r = 0; r < REPEAT; r++) { (out.A ??= []).push(await run(base)); (out.C ??= []).push(await run(hinted)); (out.D ??= []).push(await run(suffixed)); if (K > 0) (out.B ??= []).push(await run(fewshot)); }
for (const [k, label] of [["A", "(A) 이론 설명만"], ["C", "(C) +구분 단서(별도 문단)"], ["D", "(D) +구분 단서(설명 줄 끝)"], ["B", `(B) +예시 ${K}개/이론`]]) {
  for (const x of out[k] ?? []) { console.log(label, { ...x, wrong: undefined }); console.log("   틀린 것:", x.wrong.join(" | ")); }
}
process.exit(0);
const A = await run(base), B = await run(fewshot);
console.log(`모델 ${MODEL} · 채점 ${graded.length}문장`);
console.log("(A) 이론 설명만   ", { ...A, wrong: undefined });
console.log("(B) +예시 문장", K, "개/이론", { ...B, wrong: undefined });
console.log("A 틀린 것:", A.wrong.join(" | "));
console.log("B 틀린 것:", B.wrong.join(" | "));
