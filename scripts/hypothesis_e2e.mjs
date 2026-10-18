// 가설 말하기·답 받기 실전 확인(2026-10-18, 개발 1·2·5번) — 실제 dev 서버에 임시 계정으로 대화한다.
// 준비: `npm run dev`(포트 3100). 실행: node --env-file=.env.local scripts/hypothesis_e2e.mjs
// 장부에 뿌리 두 개의 점수를 미리 넣어 두고(결정적으로 하려고), 2번째 답변에 확인 문장이 붙는지 → "맞아요"가 기록되는지 → 4번째까지만 말하는지 본다.
// 끝나면 임시 계정과 해석 기록(sw_purge_user)을 모두 지운다. 대화 내용은 출력하지 않는다.
import { createClient } from "@supabase/supabase-js";
import * as RS from "../lib/interp/vendor/rootState.mjs";

const BASE = process.env.SAFETY_EVAL_BASE_URL || "http://localhost:3100";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const ok = (c, msg) => { console.log(`${c ? "✅" : "❌"} ${msg}`); if (!c) bad++; };

const email = `hypo${Date.now()}@mailinator.com`, pw = "Tmp-" + Math.random().toString(36).slice(2) + "A1!";
const { data: created, error: ce } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
if (ce) { console.error("계정 생성 실패", ce.message); process.exit(1); }
const uid = created.user.id;
const { data: si } = await anon.auth.signInWithPassword({ email, password: pw });
const token = si.session.access_token;
const chat = async (message, sessionId) => {
  const r = await fetch(`${BASE}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-access-code": process.env.ACCESS_CODE_FOR_EVAL ?? "" }, body: JSON.stringify({ message, sessionId }) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};
const assistants = async (sid) => (await admin.from("chat_messages").select("content, reflection_signal_id, reflection_response").eq("session_id", sid).eq("role", "assistant").order("created_at")).data ?? [];

try {
  // 말할 수 있는 뿌리(민감 아님, 확인 질문 있음) 두 개를 골라 점수를 넣는다. 둘의 차이를 2점 이상 벌려 가르기 질문이 아닌 가설이 나오게 한다.
  const { data: tx } = await admin.from("sw_ob_root_texts").select("root_id,check_q_1,sensitive").eq("sensitive", false).not("check_q_1", "is", null).order("root_id").limit(2);
  const [A, B] = tx.map((x) => x.root_id);
  const states = {}; const sink = [];
  for (const [r, pts] of [[A, 3], [B, 1.5]]) { const st = (states[r] = RS.newRootState(uid, r)); RS.addEvidence(st, "chat", pts, sink, { event_id: `seed:${r}`, chat_id: null, at: new Date().toISOString(), meta: { key: `${r}|seed` } }); }
  const { error: oe } = await admin.rpc("sw_apply_ops", { p_user: uid, p_ops: sink });
  ok(!oe, `장부 시드 (${A}=3.0, ${B}=1.5) ${oe?.message ?? ""}`);

  const t1 = await chat("요즘 회사 일이 너무 버거워서 많이 지쳐요", null);
  const sid = t1.sessionId;
  ok((await assistants(sid))[0].reflection_signal_id == null, "1번째 답변: 가설 없음");

  const t2 = await chat("팀장님 말 한마디에 하루 종일 신경이 쓰여요", sid);
  const a2 = (await assistants(sid))[1];
  ok(/^sw-root:/.test(a2?.reflection_signal_id ?? ""), `2번째 답변: 가설 마커 있음 (${a2?.reflection_signal_id})`);
  ok(a2?.reflection_signal_id?.includes(A), "가장 점수 높은 뿌리를 말함");
  ok(/[?？]\s*$/.test(t2.reply.trim()), "답변이 확인 질문으로 끝남");
  if (process.env.SHOW_REPLY) console.log("   [2번째 답변]\n" + t2.reply.replace(/^/gm, "   | "));
  console.log("   답변 길이", t2.reply.length, "자 · 문단", t2.reply.split(/\n\n/).length);

  const t3 = await chat("네 맞아요", sid);
  await sleep(9000); // 뒤에서 도는 답 처리 대기
  const a3 = await assistants(sid);
  ok(a3[1].reflection_response === "agree", `"맞아요" 기록됨 (reflection_response=${a3[1].reflection_response})`);
  ok(a3[2]?.reflection_signal_id == null, "3번째 답변: 답을 받는 턴이라 새 가설 없음");
  const { data: lg } = await admin.from("sw_hypothesis_log").select("chosen_root,outcome,chosen_by").eq("user_id", uid).not("outcome", "is", null);
  ok(lg?.some((x) => x.outcome === "confirmed" && x.chosen_root === A), "판정 기록 outcome=confirmed");
  const states2 = RS.hydrate(uid, (await admin.rpc("sw_read_ledger", { p_user: uid })).data ?? [], []);
  ok(states2[A]?.status === "confirmed", `장부 상태 ${A}=confirmed`);

  const t4 = await chat("요즘 팀 회의 때 제 의견을 말하기가 어렵게 느껴져요", sid);
  const a4 = await assistants(sid);
  console.log("   4번째 route:", t4.route);
  ok(/^sw-root:/.test(a4[3]?.reflection_signal_id ?? "") && a4[3].reflection_signal_id.includes(B), `4번째 답변: 다른 뿌리(${B}) 가설, 이미 확인된 ${A}는 건너뜀 (${a4[3]?.reflection_signal_id})`);

  const t5 = await chat("아니에요, 그건 아닌 것 같아요", sid);
  await sleep(9000);
  const a5 = await assistants(sid);
  ok(a5[3].reflection_response === "disagree", `"아니에요" 기록됨 (${a5[3].reflection_response})`);
  const states3 = RS.hydrate(uid, (await admin.rpc("sw_read_ledger", { p_user: uid })).data ?? [], []);
  ok(states3[B]?.status === "rejected", `장부 상태 ${B}=rejected`);
  ok(a5[4]?.reflection_signal_id == null, "5번째 답변: 가설 없음(답 받는 턴)");

  const t6 = await chat("오늘 하루는 좀 쉬어볼까 해요", sid);
  const a6 = await assistants(sid);
  ok(a6[5]?.reflection_signal_id == null, "6번째 답변: 4턴 이후 가설 없음");

  // ── 가르기 질문: 비슷한 두 뿌리가 있으면 질문 하나로 먼저 가른다 ──
  const { data: groups } = await admin.from("sw_ob_root_discriminators").select("group_id,roots,ask,options_json").limit(50);
  const { data: allTx } = await admin.from("sw_ob_root_texts").select("root_id,sensitive,check_q_1");
  const okRoot = new Set((allTx ?? []).filter((x) => !x.sensitive && x.check_q_1).map((x) => x.root_id));
  const g = (groups ?? []).find((x) => x.roots.split(",").map((y) => y.trim()).every((r) => okRoot.has(r)) && x.roots.split(",").length === 2);
  if (!g) { console.log("(가르기 질문 시험 건너뜀: 조건에 맞는 그룹 없음)"); }
  else {
    const [R1, R2] = g.roots.split(",").map((y) => y.trim());
    const opts = typeof g.options_json === "string" ? JSON.parse(g.options_json) : g.options_json;
    const sink2 = [], st2 = {};
    for (const r of [R1, R2]) { st2[r] = RS.newRootState(uid, r); RS.addEvidence(st2[r], "chat", 1.5, sink2, { event_id: `seed2:${r}`, chat_id: null, at: new Date().toISOString(), meta: { key: `${r}|seed` } }); }
    await admin.rpc("sw_apply_ops", { p_user: uid, p_ops: sink2 });
    const d1 = await chat("요즘 사람들 사이에서 눈치를 많이 보게 돼요", null);
    const dsid = d1.sessionId;
    await chat("특히 모임에 가면 더 그래요", dsid);
    const da = (await assistants(dsid))[1];
    ok(da?.reflection_signal_id === `sw-disc:${g.group_id}:${da?.reflection_signal_id?.split(":")[2]}`, `가르기 질문 마커 (${da?.reflection_signal_id})`);
    ok(da?.content.includes(g.ask), "가르기 질문 원문이 답변에 들어감");
    await chat(opts[0].answer_hint, dsid);
    await sleep(9000);
    const da2 = (await assistants(dsid))[1];
    const sd = RS.hydrate(uid, (await admin.rpc("sw_read_ledger", { p_user: uid })).data ?? [], []);
    ok(da2.reflection_response === "agree", `가르기 답 기록 (${da2.reflection_response})`);
    ok(sd[opts[0].root].score > sd[opts[1].root].score, `고른 쪽(${opts[0].root}) 점수가 더 높아짐 (${sd[opts[0].root].score} vs ${sd[opts[1].root].score})`);
  }
} catch (e) {
  console.error("❌ 오류:", e.message); bad++;
} finally {
  await admin.rpc("sw_purge_user", { p_user: uid, p_include_human: true });
  await admin.auth.admin.deleteUser(uid);
}
console.log(bad ? `\n실패 ${bad}건` : "\n전부 통과");
process.exit(bad ? 1 : 0);
