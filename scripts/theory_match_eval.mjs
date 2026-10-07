// 이론 매칭 임계값 점검: matching_eval_set의 문장을 theory_signals(판별 문장)와 비교해, 이론 선택 규칙(A: 최소 점수, B: 1·2등 차이)을
// 바꿔 가며 "얼마나 골랐고(채택률), 골랐을 때 얼마나 맞았는지(정밀도)"를 표로 보여준다. DB에는 쓰지 않는다.
//   node --env-file=.env.local scripts/theory_match_eval.mjs
// 정답 라벨은 사람이 쓴 자유 문장(예: "TH-ST (허용 대안: TH-EFT)", "경합: TH-DBT vs EFT")이라 라벨 안에 나오는 이론 약어를 모두
// "허용 이론"으로 본다. '해당 없음/안전 라우터…/보류' 라벨은 "아무 이론도 고르면 안 되는 문장"으로 센다.
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI();
const THEORIES = ["ACT", "CFT", "DBT", "CBT", "REBT", "RBT", "ST", "LTA", "IPT", "WBT", "PPT", "EFT", "LOGO", "MCP"];
const TOP_PER_THEORY = 3, MIN_HITS = 2;

const { data: evals, error } = await admin.from("matching_eval_set").select("*").order("eval_id");
if (error) throw error;

function allowed(label) {
  const set = new Set();
  for (const t of THEORIES) if (new RegExp(`(^|[^A-Za-z])(TH-)?${t}([^A-Za-z]|$)`).test(label)) set.add(t);
  return set;
}
const none = (label) => /^해당 없음|^안전|^매칭 보류|애도|🔒/.test(label) && allowed(label).size === 0 || /^해당 없음\(|매칭 보류|^안전 라우터/.test(label);

const rows = [];
for (let i = 0; i < evals.length; i += 50) {
  const part = evals.slice(i, i + 50);
  const emb = await openai.embeddings.create({ model: "text-embedding-3-small", input: part.map((e) => e.utterance), encoding_format: "float" });
  for (let k = 0; k < part.length; k++) {
    let data = null, e2 = null;
    for (let t = 0; t < 5 && !data; t++) {   // 연속 호출 중 간헐적 네트워크 끊김(ECONNRESET)이 있어 다시 시도한다
      try { ({ data, error: e2 } = await admin.rpc("match_theory_signals", { query_embedding: JSON.stringify(emb.data[k].embedding), match_count: 40, min_similarity: 0, current_route: "wellness" })); }
      catch (e) { e2 = e; data = null; await new Promise((r) => setTimeout(r, 1000 * (t + 1))); }
    }
    if (!data) throw e2;
    const by = new Map();
    for (const h of data) { const t = h.theory_id.replace("TH-", ""); (by.get(t) ?? by.set(t, []).get(t)).push(h.similarity); }
    const scores = [...by].filter(([, l]) => l.length >= MIN_HITS).map(([t, l]) => ({ t, s: l.slice(0, TOP_PER_THEORY).reduce((a, b) => a + b, 0) / Math.min(TOP_PER_THEORY, l.length) })).sort((x, y) => y.s - x.s);
    rows.push({ id: part[k].eval_id, label: part[k].expected_label, scores, top: data[0] });
  }
}
const withTheory = rows.filter((r) => allowed(r.label).size > 0 && !none(r.label));
const noTheory = rows.filter((r) => none(r.label));
console.log(`평가 문장 ${rows.length}개 — 이론이 정답인 ${withTheory.length}개, 이론을 고르면 안 되는 ${noTheory.length}개(나머지는 애매한 라벨)`);
const top1 = withTheory.filter((r) => r.scores[0] && allowed(r.label).has(r.scores[0].t)).length;
console.log(`임계값 없이 1등만 봤을 때 정답(허용 이론 안): ${top1}/${withTheory.length} = ${(100 * top1 / withTheory.length).toFixed(0)}%`);
const top3 = withTheory.filter((r) => r.scores.slice(0, 3).some((x) => allowed(r.label).has(x.t))).length;
console.log(`상위 3개 안에 정답 이론이 있음: ${top3}/${withTheory.length} = ${(100 * top3 / withTheory.length).toFixed(0)}%`);
const sc1 = rows.map((r) => r.scores[0]?.s ?? 0).sort((a, b) => a - b);
console.log("1등 점수 분포(최소/중앙/최대):", sc1[0].toFixed(2), sc1[Math.floor(sc1.length / 2)].toFixed(2), sc1[sc1.length - 1].toFixed(2));
const gaps = rows.map((r) => (r.scores[0]?.s ?? 0) - (r.scores[1]?.s ?? 0)).sort((a, b) => a - b);
console.log("1·2등 차이 분포(최소/중앙/최대):", gaps[0].toFixed(3), gaps[Math.floor(gaps.length / 2)].toFixed(3), gaps[gaps.length - 1].toFixed(3));
console.log("\n   A     B   | 채택률(이론 정답 문장) | 정밀도(채택 중 정답) | 잘못 채택(이론 없어야 하는 문장)");
for (const A of [0.30, 0.35, 0.40, 0.45, 0.50]) for (const B of [0, 0.02, 0.04, 0.06]) {
  const pick = (r) => { const [b, s] = r.scores; return b && b.s >= A && (!s || b.s - s.s >= B) ? b.t : null; };
  const picked = withTheory.filter((r) => pick(r)); const right = picked.filter((r) => allowed(r.label).has(pick(r)));
  const fp = noTheory.filter((r) => pick(r));
  console.log(`${A.toFixed(2)}  ${B.toFixed(2)} | ${(100 * picked.length / withTheory.length).toFixed(0).padStart(3)}% (${picked.length}/${withTheory.length}) | ${picked.length ? (100 * right.length / picked.length).toFixed(0) : "-"}% (${right.length}/${picked.length}) | ${fp.length}/${noTheory.length}`);
}

// 공감 문장 기준 R 점검: 문장 1개와 가장 가까운 판별 문장의 유사도가 R 이상일 때, 그 판별 문장의 이론이 정답 이론 안에 있는 비율.
// (공감 문장의 정답 라벨은 아직 없어서 "이론이 맞으면 공감 짐작도 맞을 가능성이 높다"는 대리 지표다 — 실제 정밀도는 더 낮을 수 있다.)
console.log("\n   R   | 공감 후보가 되는 문장(이론 정답 문장 중) | 그 이론이 정답 안에 있는 비율(대리 정밀도) | 이론 없어야 하는 문장에서 후보가 됨");
for (const R of [0.45, 0.50, 0.55, 0.60, 0.65, 0.70]) {
  const cand = withTheory.filter((r) => r.top && r.top.similarity >= R); const ok = cand.filter((r) => allowed(r.label).has(r.top.theory_id.replace("TH-", "")));
  const fp = noTheory.filter((r) => r.top && r.top.similarity >= R);
  console.log(`${R.toFixed(2)} | ${cand.length}/${withTheory.length} | ${cand.length ? (100 * ok.length / cand.length).toFixed(0) : "-"}% (${ok.length}/${cand.length}) | ${fp.length}/${noTheory.length}`);
}
