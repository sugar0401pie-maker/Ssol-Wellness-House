// 점성술 단서 확인(2026-10-20, 로드맵 7번) — 실제 점성술 결과 몇 건을 읽기만 하고(점성술 앱 표에는 쓰지 않음), 임시 사용자 장부에 반영해
// 점수·상한·멱등·결과 교체(재반영)를 확인한다. 끝나면 임시 기록 삭제. 결과 내용(답 원문)은 출력하지 않는다.
//   node --env-file=.env.local scripts/astro_cues_e2e.mjs
import { createClient } from "@supabase/supabase-js";
import * as RS from "../lib/interp/vendor/rootState.mjs";
import * as LD from "../lib/interp/vendor/dbLoader.mjs";
import { buildHandoff } from "../lib/interp/astroInput.ts";

const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let bad = 0; const ok = (c, m) => { console.log(`${c ? "✅" : "❌"} ${m}`); if (!c) bad++; };
const t = {}; for (const n of ["sw_ob_astro_cues", "sw_ob_astro_cue_hyps", "sw_ob_astro_sign_element", "sw_ob_astro_statements"]) { const o = []; for (let f = 0; ; f += 1000) { const { data } = await a.from(n).select("*").range(f, f + 999); o.push(...data); if (data.length < 1000) break; } t[n] = o; }
RS.setData({ astroCues: LD.astroCuesFromDb(t), astroStatements: LD.astroStatementsFromDb(t) });
const rows = (await a.from("astro_results").select("id,created_at,answers,competency,style,sun_sign,accuracy").not("user_id", "is", null).order("created_at", { ascending: false }).limit(40)).data;
const hs = rows.map(buildHandoff).filter(Boolean);
ok(hs.length >= 5, `실제 결과 ${hs.length}건에서 handoff 만듦`);
// 1) 여러 실제 결과로 점수 분포 확인(메모리)
let withRoots = 0, maxPts = 0, over = 0;
for (const h of hs) { const st = {}, sink = []; RS.applyAstro(st, "00000000-0000-0000-0000-000000000009", h, sink); const sc = Object.values(st); if (sc.length) withRoots++; for (const s of sc) { maxPts = Math.max(maxPts, s.score); if (s.score > 3.0001) over++; } }
ok(withRoots === hs.length, `모든 결과가 최소 한 뿌리에 단서를 만듦 (${withRoots}/${hs.length}) · 최고 뿌리 점수 ${maxPts}`);
ok(over === 0, "출처별 상한(Q 2.0 + 성향 1.0) 안쪽 — 한 뿌리가 3.0을 넘지 않음");
// 2) 임시 사용자 장부: 저장→다시 읽기→재반영 멱등→다른 결과로 교체
const email = `astrocue${Date.now()}@mailinator.com`;
const { data: u } = await a.auth.admin.createUser({ email, password: "Tmp-" + Math.random().toString(36).slice(2) + "A1!", email_confirm: true });
const uid = u.user.id;
const apply = async (h) => { const { data } = await a.rpc("sw_read_ledger", { p_user: uid }); const st = RS.hydrate(uid, data ?? [], []); const sink = []; RS.applyAstro(st, uid, h, sink); if (sink.length) { const { error } = await a.rpc("sw_apply_ops", { p_user: uid, p_ops: sink }); if (error) throw new Error(error.message); } return sink.length; };
const scores = async () => Object.fromEntries(Object.values(RS.hydrate(uid, (await a.rpc("sw_read_ledger", { p_user: uid })).data ?? [], [])).filter((s) => s.score > 0).map((s) => [s.root_id, s.score]));
try {
  const [h1, h2] = [hs[0], hs.find((h) => h.answers.q1_domain !== hs[0].answers.q1_domain || h.answers.q3_wish_2027 !== hs[0].answers.q3_wish_2027) ?? hs[1]];
  const n1 = await apply(h1); const s1 = await scores();
  ok(n1 > 0 && Object.keys(s1).length > 0, `첫 반영: 사건 ${n1}건 · 뿌리 ${Object.keys(s1).length}개`);
  ok((await apply(h1)) === 0, "같은 결과를 다시 반영해도 변화 없음(멱등)");
  const direct = {}; { const st = {}; RS.applyAstro(st, uid, h1, []); for (const s of Object.values(st)) direct[s.root_id] = s.score; }
  ok(JSON.stringify(Object.entries(s1).sort()) === JSON.stringify(Object.entries(direct).sort()), "장부에서 다시 읽은 점수 = 계산 점수");
  const n2 = await apply(h2); const s2 = await scores();
  ok(n2 > 0 && JSON.stringify(s1) !== JSON.stringify(s2), `다른 결과로 바꾸면 이전 점성술 근거가 대체됨(사건 ${n2}건)`);
  const d2 = {}; { const st = {}; RS.applyAstro(st, uid, h2, []); for (const s of Object.values(st)) d2[s.root_id] = s.score; }
  ok(Object.keys(s2).length === Object.keys(d2).length && Object.entries(d2).every(([r, p]) => s2[r] === p), "교체 뒤 점수 = 새 결과 점수만(이전 근거 남지 않음)");
  const src = (await a.from("sw_evidence_events").select("source_type").eq("user_id", uid).eq("validity", "active")).data;
  ok(src.every((x) => x.source_type === "astro_q" || x.source_type === "astro_profile"), `출처 표시: ${[...new Set(src.map((x) => x.source_type))].join(", ")}`);
} catch (e) { console.error("❌ 오류:", e.message); bad++; }
finally { await a.rpc("sw_purge_user", { p_user: uid, p_include_human: true }); await a.auth.admin.deleteUser(uid); }
console.log(bad ? `\n실패 ${bad}건` : "\n전부 통과"); process.exit(bad ? 1 : 0);
