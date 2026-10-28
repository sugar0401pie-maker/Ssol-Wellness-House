// 성장 방향·동기 위치 기록 실전 확인(2026-10-28, CSO 묶음 v1.5) — dev 서버에 임시 계정으로 대화한다.
// 준비: npx next dev -p 3100. 실행: node --env-file=.env.local scripts/growth_e2e.mjs
// 확인: ① 방향 말("숨 한 번 고르고 말했어요")이 sw_user_signals에 항목·claim·메시지 id만 저장(말 원문 없음) ② 마이페이지 "요즘의 변화" 한 줄
//       ③ 몸 단계 말("요즘 계속 새벽에 깨요")에도 채팅이 정상 답 ④ 기록 삭제(sw_purge_user)가 이 신호도 지움. 분류는 AI라 흔들릴 수 있어 ①은 기다려 본다. 끝나면 계정 삭제.
import { createClient } from "@supabase/supabase-js";
const BASE = process.env.SAFETY_EVAL_BASE_URL || "http://localhost:3100";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0; const ok = (c, m) => { console.log(`${c ? "✅" : "❌"} ${m}`); if (!c) bad++; };
const email = `growth${Date.now()}@mailinator.com`, pw = "Tmp-" + Math.random().toString(36).slice(2) + "A1!";
const { data: u } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
const uid = u.user.id;
const token = (await anon.auth.signInWithPassword({ email, password: pw })).data.session.access_token;
const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-access-code": process.env.ACCESS_CODE_FOR_EVAL ?? "" };
const chat = async (message, sessionId) => { const r = await fetch(`${BASE}/api/chat`, { method: "POST", headers: H, body: JSON.stringify({ message, sessionId }) }); return { status: r.status, ...(await r.json()) }; };
const sigs = async () => (await admin.from("sw_user_signals").select("slot,value,observed_at,ref").eq("user_id", uid)).data ?? [];
try {
  const a = await chat("요즘 회사에서 감정을 다스리는 게 어려워요", null);
  ok(a.status === 200 && !!a.reply, "첫 말에 정상 답");
  const MSG = "예전 같으면 바로 화냈을 텐데 이번엔 숨 한 번 고르고 말했어요";
  const b = await chat(MSG, a.sessionId);
  ok(b.status === 200 && !!b.reply, "방향 말에 정상 답");
  let rows = []; for (let i = 0; i < 16 && !rows.some((r) => r.slot.startsWith("growth.")); i++) { await sleep(2500); rows = await sigs(); }
  const g = rows.find((r) => r.slot.startsWith("growth."));
  ok(!!g, `방향 신호가 기록됨 (${g?.slot ?? "분류기가 이번엔 못 잡음 — AI라 흔들릴 수 있음"})`);
  if (g) {
    ok(Object.keys(g.value).every((k) => ["claim_id", "roots", "message_id"].includes(k)), `저장 칸은 항목·claim·뿌리·메시지 id뿐 (${Object.keys(g.value).join(",")})`);
    ok(!JSON.stringify(rows).includes("숨 한 번"), "사용자 말 원문이 저장되지 않음");
    const r = await fetch(`${BASE}/api/mypage/insights`, { headers: H }); const j = await r.json();
    ok(r.status === 200 && Array.isArray(j.growth) && j.growth.length > 0, `마이페이지 변화 한 줄: ${JSON.stringify(j.growth)}`);
    await sleep(500);
    const again = (await sigs()).filter((r) => r.slot === g.slot).length;
    ok(again === rows.filter((r) => r.slot === g.slot).length, "같은 기록이 중복 저장되지 않음");
  }
  const c = await chat("요즘 계속 새벽에 깨요. 뭘 해보면 좋을까요?", a.sessionId);
  ok(c.status === 200 && !!c.reply, "몸 단계 말에도 채팅이 정상 답");
  const { data: purge } = await admin.rpc("sw_purge_user", { p_user: uid, p_include_human: true });
  ok((await sigs()).length === 0, `삭제 요청이 방향 신호도 지움 ${JSON.stringify(purge?.sw_user_signals ?? "")}`);
} finally { await admin.rpc("sw_purge_user", { p_user: uid, p_include_human: true }); await admin.auth.admin.deleteUser(uid); }
console.log(bad ? `\n실패 ${bad}건` : "\n전부 통과"); process.exit(bad ? 1 : 0);
