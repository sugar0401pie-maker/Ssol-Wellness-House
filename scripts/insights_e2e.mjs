// 마이페이지 "쏘웰라가 파악한 내용" API + 뿌리 기반 실천 가산 경로 실전 확인(2026-10-18, 로드맵 6·10번).
// 준비: `npm run dev`(포트 3100). 실행: node --env-file=.env.local scripts/insights_e2e.mjs
// 임시 계정에 장부 점수를 넣고 → 목록 → 맞아요/아니에요/지우기/전부 지우기를 차례로 확인한다. 끝나면 계정·기록 삭제.
import { createClient } from "@supabase/supabase-js";
import * as RS from "../lib/interp/vendor/rootState.mjs";

const BASE = process.env.SAFETY_EVAL_BASE_URL || "http://localhost:3100";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
let bad = 0;
const ok = (c, msg) => { console.log(`${c ? "✅" : "❌"} ${msg}`); if (!c) bad++; };

const email = `insight${Date.now()}@mailinator.com`, pw = "Tmp-" + Math.random().toString(36).slice(2) + "A1!";
const { data: created, error: ce } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
if (ce) { console.error("계정 생성 실패", ce.message); process.exit(1); }
const uid = created.user.id;
const token = (await anon.auth.signInWithPassword({ email, password: pw })).data.session.access_token;
const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-access-code": process.env.ACCESS_CODE_FOR_EVAL ?? "" };
const api = async (method, body) => { const r = await fetch(`${BASE}/api/mypage/insights`, { method, headers: H, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, json: await r.json().catch(() => ({})) }; };

try {
  const { data: tx } = await admin.from("sw_ob_root_texts").select("root_id,report,sensitive").eq("sensitive", false).neq("report", "").order("root_id").limit(3);
  const [A, B, C] = tx.map((x) => x.root_id);
  const sink = []; const now = new Date().toISOString();
  for (const [r, pts] of [[A, 3], [B, 1.5], [C, 0.4]]) { const st = RS.newRootState(uid, r); RS.addEvidence(st, "chat", pts, sink, { event_id: `seed:${r}`, chat_id: null, at: now, meta: { key: `${r}|seed` } }); }
  await admin.rpc("sw_apply_ops", { p_user: uid, p_ops: sink });

  const noAuth = await fetch(`${BASE}/api/mypage/insights`, { headers: { "x-access-code": process.env.ACCESS_CODE_FOR_EVAL ?? "" } });
  ok(noAuth.status === 401, `로그인 없이 접근 막힘 (${noAuth.status})`);

  let r = await api("GET");
  ok(r.json.items?.map((x) => x.rootId).join() === [A, B].join(), `목록: 점수 1.0 이상 둘만 (${r.json.items?.map((x) => x.rootId)})`);
  ok(r.json.items?.every((x) => x.status === "guess" && x.text.length > 10), "짐작 상태·문장 있음");

  r = await api("PATCH", { rootId: A, action: "confirm" });
  ok(r.json.items?.[0]?.rootId === A && r.json.items[0].status === "confirmed", "맞아요 → 확인됨 표시");
  r = await api("PATCH", { rootId: B, action: "reject" });
  ok(!r.json.items?.some((x) => x.rootId === B), "아니에요 → 목록에서 사라짐");
  r = await api("PATCH", { rootId: A, action: "remove" });
  ok(r.json.items?.length === 0, "지우기 → 근거 삭제로 사라짐");
  ok((await api("PATCH", { rootId: "ROOT-1; x", action: "confirm" })).status === 400, "잘못된 뿌리 id 거부");
  ok((await api("PATCH", { rootId: A, action: "explode" })).status === 400, "잘못된 동작 거부");
  ok((await api("PATCH", { rootId: "ROOT-9999", action: "confirm" })).status === 404, "없는 뿌리 404");

  // 전부 지우기
  const sink2 = []; const st = RS.newRootState(uid, A); RS.addEvidence(st, "chat", 2, sink2, { event_id: `seed2:${A}`, chat_id: null, at: now, meta: { key: `${A}|seed2` } });
  await admin.rpc("sw_apply_ops", { p_user: uid, p_ops: sink2 });
  ok((await api("GET")).json.items?.length === 1, "다시 쌓인 뒤 1건");
  r = await api("DELETE");
  ok(r.json.items?.length === 0 && (await api("GET")).json.items.length === 0, "전부 지우기 → 비어 있음");

  // 뿌리 기반 실천 가산 경로가 채팅을 깨지 않는지(가능성 높은 뿌리를 넣고 3번째 답변까지 실제 대화)
  const sink3 = []; const st3 = RS.newRootState(uid, A); RS.addEvidence(st3, "chat", 3, sink3, { event_id: `seed3:${A}`, chat_id: null, at: now, meta: { key: `${A}|seed3` } });
  await admin.rpc("sw_apply_ops", { p_user: uid, p_ops: sink3 });
  let sid = null;
  for (const m of ["요즘 회사에서 의욕이 잘 안 나요", "그냥 계속 미루게 돼요", "지금 해볼 수 있는 게 뭐가 있을까요"]) {
    const res = await fetch(`${BASE}/api/chat`, { method: "POST", headers: H, body: JSON.stringify({ message: m, sessionId: sid }) });
    const j = await res.json(); sid = j.sessionId ?? sid;
    ok(res.ok && typeof j.reply === "string" && j.reply.length > 0, `채팅 정상 (${m.slice(0, 8)}…, ${res.status})`);
  }
} catch (e) {
  console.error("❌ 오류:", e.message); bad++;
} finally {
  await admin.rpc("sw_purge_user", { p_user: uid, p_include_human: true });
  await admin.auth.admin.deleteUser(uid);
}
console.log(bad ? `\n실패 ${bad}건` : "\n전부 통과");
process.exit(bad ? 1 : 0);
