// 판별 문장 점수 연결(SIG6) 구현 전 측정·시뮬레이션 (2026-10-28, docs/판별문장_연결_설계_v0.1.md B-5). 읽기 전용 — DB에 쓰지 않는다.
//   node --env-file=.env.local scripts/sw_signal_measure.mjs [출력 json]
// A) leave-one-out: 판별 문장 하나를 사용자 말로 보고, 그 문장을 뺀 나머지에서 가장 비슷한 문장을 찾아 "같은 뿌리를 가리키는가"를 임계값별로 센다(말이 거의 같은 문장 사이라 위쪽 한계에 가깝다).
// B) 평가 문장 90개(matching_eval_set, 정답 이론/해당 없음 라벨): 진짜 새 말로 가장 비슷한 판별 문장을 찾아 "정답 이론이 맞는가 · 해당 없음인데 잘못 잡았는가"를 임계값별로 센다.
// C) 합계 상한 시뮬레이션: 한 사용자가 같은 뿌리의 판별 문장을 연달아 말할 때(일관된 대화)와 아무 문장이나 섞어 말할 때(잡음) 뿌리별 합계가 상한 값에 따라 어떻게 쌓이는지.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const openai = new OpenAI();
const page = async (t, cols) => { const o = []; for (let f = 0; ; f += 500) { const { data, error } = await admin.from(t).select(cols).range(f, f + 499); if (error) throw new Error(`${t}: ${error.message}`); o.push(...data); if (data.length < 500) return o; } };
const cosine = (a, b) => { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return d / Math.sqrt(na * nb); };
const parse = (v) => (typeof v === "string" ? JSON.parse(v) : v);

const sigs = (await page("theory_signals", "signal_id,theory_id,utterance,embedding")).filter((s) => s.embedding).map((s) => ({ ...s, e: parse(s.embedding) }));
const links = await page("sw_ob_signal_roots", "signal_id,root_id,via,weight");
const by = new Map(); for (const l of links) (by.get(l.signal_id) ?? by.set(l.signal_id, []).get(l.signal_id)).push({ root: l.root_id, via: l.via, w: Number(l.weight ?? 1) });
const linked = sigs.filter((s) => by.has(s.signal_id));
console.log(`판별 문장 ${sigs.length}개(임베딩 있음) · 그중 뿌리 연결 있음 ${linked.length}개 · 연결 ${links.length}행`);

const T = [0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8];
const out = { counts: { signals: sigs.length, linked: linked.length, links: links.length } };

// ───── A) leave-one-out
const rootsOf = (id) => new Set((by.get(id) ?? []).map((x) => x.root));
const loo = linked.map((s) => {
  let best = null, bs = -1;
  for (const o of linked) { if (o.signal_id === s.signal_id) continue; const c = cosine(s.e, o.e); if (c > bs) { bs = c; best = o; } }
  const a = rootsOf(s.signal_id), b = rootsOf(best.signal_id);
  return { sim: bs, hit: [...a].some((r) => b.has(r)), sameTheory: best.theory_id === s.theory_id };
});
out.loo = T.map((t) => { const ad = loo.filter((x) => x.sim >= t); return { t, 채택: ad.length, 채택률: +(ad.length / loo.length).toFixed(3), 같은뿌리: ad.length ? +(ad.filter((x) => x.hit).length / ad.length).toFixed(3) : null, 다른이론_채택: ad.filter((x) => !x.sameTheory).length }; });

// ───── B) 평가 문장 90
const ev = await page("matching_eval_set", "eval_id,utterance,expected_label");
const E = []; for (let i = 0; i < ev.length; i += 90) { const r = await openai.embeddings.create({ model: "text-embedding-3-small", input: ev.slice(i, i + 90).map((x) => x.utterance), encoding_format: "float" }); E.push(...r.data.map((d) => d.embedding)); }
const evr = ev.map((x, i) => {
  let best = null, bs = -1; for (const s of sigs) { const c = cosine(E[i], s.e); if (c > bs) { bs = c; best = s; } }
  const none = /해당 없음/.test(x.expected_label);
  const exp = (x.expected_label.match(/TH-[A-Z]+/) ?? [])[0] ?? null;
  return { sim: bs, none, exp, pred: best.theory_id, ok: !none && exp === best.theory_id, anyRoots: by.has(best.signal_id) };
});
out.eval = { total: ev.length, 해당없음: evr.filter((x) => x.none).length, 이론정답: evr.filter((x) => !x.none).length, 임계값별: T.map((t) => { const ad = evr.filter((x) => x.sim >= t); const pos = ad.filter((x) => !x.none); return { t, 채택: ad.length, 해당없음인데_채택: ad.filter((x) => x.none).length, 이론정답_중_채택: pos.length, 채택한_것의_정답률: pos.length ? +(pos.filter((x) => x.ok).length / pos.length).toFixed(3) : null }; }) };
out.eval.유사도분포 = { 해당없음_평균: +(evr.filter((x) => x.none).reduce((a, x) => a + x.sim, 0) / Math.max(1, evr.filter((x) => x.none).length)).toFixed(3), 이론정답_평균: +(evr.filter((x) => !x.none).reduce((a, x) => a + x.sim, 0) / Math.max(1, evr.filter((x) => !x.none).length)).toFixed(3) };

// ───── C) 합계 상한 시뮬레이션
const CAPS = [1.0, 1.5, 2.0, 3.0, 99];
const rootSigs = new Map(); for (const s of linked) for (const l of by.get(s.signal_id)) (rootSigs.get(l.root) ?? rootSigs.set(l.root, []).get(l.root)).push({ id: s.signal_id, w: l.w });
const roots = [...rootSigs.keys()].filter((r) => rootSigs.get(r).length >= 3);
const rnd = (n) => Math.floor(Math.random() * n);
const sim = (pick, perMsgRoots = 3) => { // pick: 말마다 고른 판별 문장 id 배열 → 뿌리별 합계(상한 적용 전/후)
  const sum = {}; for (const id of pick) { const ls = [...by.get(id)].sort((a, b) => b.w - a.w).slice(0, perMsgRoots); for (const l of ls) sum[l.root] = (sum[l.root] ?? 0) + l.w; } return sum;
};
const cap = (sum, c) => Object.fromEntries(Object.entries(sum).map(([r, v]) => [r, Math.min(v, c)]));
out.cap = {};
for (const k of [1, 2, 4, 8]) { // 같은 뿌리의 문장을 k번 말하는 일관된 대화(500번 반복)
  const row = {}; for (const c of CAPS) row[c] = 0;
  const raw = [];
  for (let n = 0; n < 500; n++) { const r = roots[rnd(roots.length)]; const pool = rootSigs.get(r); const pick = Array.from({ length: k }, () => pool[rnd(pool.length)].id); const sum = sim(pick); raw.push(sum[r] ?? 0); for (const c of CAPS) row[c] += Math.min(sum[r] ?? 0, c); }
  out.cap[`일관_${k}번`] = { 상한없는_평균: +(raw.reduce((a, b) => a + b, 0) / raw.length).toFixed(2), 최대: +Math.max(...raw).toFixed(2), 상한별_평균: Object.fromEntries(CAPS.map((c) => [c, +(row[c] / 500).toFixed(2)])) };
}
for (const k of [4, 8]) { // 아무 문장이나 섞어 k번(잡음) — 어느 한 뿌리가 얼마나 올라가는가
  const maxes = []; const above = Object.fromEntries(CAPS.map((c) => [c, 0]));
  for (let n = 0; n < 500; n++) { const pick = Array.from({ length: k }, () => linked[rnd(linked.length)].signal_id); const sum = sim(pick); maxes.push(Math.max(0, ...Object.values(sum))); for (const c of CAPS) above[c] += Object.values(cap(sum, c)).filter((v) => v >= 2.0).length; }
  out.cap[`잡음_${k}번`] = { 한뿌리_최대합계_평균: +(maxes.reduce((a, b) => a + b, 0) / maxes.length).toFixed(2), 최대: +Math.max(...maxes).toFixed(2), "2.0 이상에 닿은 뿌리 수(500회 합계)": above };
}
// ───── D) 뿌리 수준 정확도: CSO 평가 세트 E1(사용자 말 876개, 정답 뿌리·금지 뿌리 라벨)로 "가장 비슷한 판별 문장 → 그 문장의 뿌리"가 정답 뿌리를 가리키는지 센다(진짜 새 말).
const E1PATH = process.env.E1_PATH;
if (E1PATH) {
  const rows = fs.readFileSync(E1PATH, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const Q = []; for (let i = 0; i < rows.length; i += 200) { const r = await openai.embeddings.create({ model: "text-embedding-3-small", input: rows.slice(i, i + 200).map((x) => x.text), encoding_format: "float" }); Q.push(...r.data.map((d) => d.embedding)); }
  const res = rows.map((x, i) => {
    let best = null, bs = -1; for (const s of linked) { const c = cosine(Q[i], s.e); if (c > bs) { bs = c; best = s; } }
    const pr = (by.get(best.signal_id) ?? []).map((l) => l.root);
    const exp = x.expected_roots ?? [], forb = x.forbidden_roots ?? [];
    return { sim: bs, hasExp: exp.length > 0, hit: pr.some((r) => exp.includes(r)), bad: pr.some((r) => forb.includes(r)), top: pr.filter((r) => exp.includes(r)).length > 0 };
  });
  const pos = res.filter((x) => x.hasExp);
  out.e1 = { 전체: rows.length, 정답뿌리_있는_말: pos.length, 정답뿌리_없는_말: rows.length - pos.length, 임계값별: T.map((t) => { const ad = res.filter((x) => x.sim >= t); const adp = ad.filter((x) => x.hasExp); return { t, 채택: ad.length, 채택률: +(ad.length / rows.length).toFixed(3), 정답_뿌리를_가리킴: adp.length ? +(adp.filter((x) => x.hit).length / adp.length).toFixed(3) : null, 금지_뿌리를_가리킴: ad.filter((x) => x.bad).length, 정답뿌리_없는데_채택: ad.length - adp.length }; }) };
}
console.log(JSON.stringify(out, null, 1));
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
