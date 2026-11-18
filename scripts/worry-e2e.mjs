// 첫 말 → 세부 고민(2026-11-18 3부-2) 실전 확인 — 떠 있는 dev 서버(포트 3100)에 진짜 요청을 보내 첫 답변과 걸린 시간을 본다.
// 실행: node --env-file=.env.local scripts/worry-e2e.mjs
// 임시 계정(mailinator)을 만들어 쓰고 끝나면 대화와 함께 삭제한다(scripts/safety-eval.mjs와 같은 방식). 비용: 대화당 몇 원.
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.WORRY_E2E_BASE_URL || "http://localhost:3100";
const FIRSTS = process.argv[2] ? [process.argv[2]] : ["회사 그만두고 싶은데 너무 지쳐요", "썸 타는 사람이 연락이 뜸해졌어요. 저를 어떻게 생각하는 걸까요", "요즘 그냥 다 귀찮고 아무것도 하기 싫어요"];

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const email = `worrye2e${Date.now()}@mailinator.com`;
const password = "Tmp-" + Math.random().toString(36).slice(2) + "A1!";
const { data: created, error: ce } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (ce || !created?.user) { console.error("임시 계정 생성 실패:", ce?.message); process.exit(1); }
const userId = created.user.id;
try {
  const { data: si, error: se } = await anon.auth.signInWithPassword({ email, password });
  if (se || !si.session) throw new Error("임시 계정 로그인 실패");
  const send = async (message, sessionId) => {
    const t0 = Date.now();
    const r = await fetch(`${BASE_URL}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${si.session.access_token}`, "x-access-code": process.env.ACCESS_CODE_FOR_EVAL ?? "" }, body: JSON.stringify({ message, sessionId }) });
    const timing = r.headers.get("server-timing") ?? "";
    return { ms: Date.now() - t0, timing, data: await r.json() };
  };
  for (const m of FIRSTS) {
    const a = await send(m);
    const wm = /worry_match;dur=([\d.]+)/.exec(a.timing)?.[1];
    const { data: s } = await admin.from("chat_sessions").select("*").eq("session_id", a.data.sessionId).maybeSingle();
    console.log(`\n“${m}” → ${a.data.route} · 전체 ${a.ms}ms · 세부 고민 대기 ${wm ?? "-"}ms\n 기록: ${s && "worry_pick" in s ? JSON.stringify(s.worry_pick) : "(worry_pick 칸 없음 — 마이그레이션 전)"}\n 답: ${a.data.reply}`);
    if (a.data.card) console.log(` 카드: ${a.data.card.text}`);
    if (a.data.followUp?.card) console.log(` 카드(뒤따름): ${a.data.followUp.card.text} / ${a.data.followUp.card.options?.map((o) => `${o.id} ${o.label}`).join(" · ")}`);
  }
} finally {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) console.warn("임시 계정 정리 실패(수동 확인 필요):", error.message);
}
