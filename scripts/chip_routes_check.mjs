// 일상 고민 시작 문구(EVERYDAY_QUESTION_GROUPS) 12개가 실제 안전 라우터에서 일반 대화(wellness/life_decision)로 처리되는지, 그리고 답변이 정상으로 오는지 본다(2026-10-22).
//   node --env-file=.env.local scripts/chip_routes_check.mjs  (dev 서버 3100 필요, 임시 계정 사용 후 삭제)
import { createClient } from "@supabase/supabase-js";
import { EVERYDAY_QUESTION_GROUPS } from "../lib/persona/suggestedQuestions.ts";
const BASE = process.env.SAFETY_EVAL_BASE_URL || "http://localhost:3100";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const email = `chiprt${Date.now()}@mailinator.com`, pw = "Tmp-" + Math.random().toString(36).slice(2) + "A1!";
const { data: u } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true }); const uid = u.user.id;
const token = (await anon.auth.signInWithPassword({ email, password: pw })).data.session.access_token;
const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-access-code": process.env.ACCESS_CODE_FOR_EVAL ?? "" };
let bad = 0;
try {
  for (const g of EVERYDAY_QUESTION_GROUPS) for (const q of g.questions) {
    const r = await (await fetch(`${BASE}/api/chat`, { method: "POST", headers: H, body: JSON.stringify({ message: q.text, sessionId: null }) })).json();
    const ok = ["wellness", "life_decision"].includes(r.route) && typeof r.reply === "string" && r.reply.length > 60 && !/테스트 결과가 필요해요/.test(r.reply);
    if (!ok) bad++; console.log(`${ok ? "✅" : "❌"} [${r.route}] ${q.id} (답변 ${r.reply?.length ?? 0}자)`);
  }
} finally { await admin.rpc("sw_purge_user", { p_user: uid, p_include_human: true }); await admin.auth.admin.deleteUser(uid); }
console.log(bad ? `\n실패 ${bad}건` : "\n전부 일반 대화로 처리됨"); process.exit(bad ? 1 : 0);
