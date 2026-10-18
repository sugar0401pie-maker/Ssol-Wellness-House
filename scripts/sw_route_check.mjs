// 실제 안전 라우터(lib/safety)가 문장을 어느 route로 보내는지 확인 — 2026-10-18
// 해석 분류기는 위기·폭력으로 걸러진 말에는 돌지 않는다. 그래서 "위기 문장이 lib/safety를 통과해 분류기까지 오는가"가 진짜 누출 지표다.
// 실제 서비스와 같은 경로(HTTP /api/chat)로 보내므로 dev 서버(npm run dev, 포트 3100)가 필요하다. 임시 계정은 끝나면 삭제한다.
//   node scripts/sw_route_check.mjs --in <jsonl: {id,text,...}> --out <결과 json>
// 비위기 route로 간 문장은 답변이 생성되어 문장당 몇 원이 든다(위기·폭력은 고정 응답이라 AI 호출 없음). 문장 원문은 출력하지 않는다.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
try { process.loadEnvFile(".env.local"); } catch { /* 환경 변수가 이미 있으면 됨 */ }
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const IN = arg("--in"), OUT = arg("--out"), BASE = process.env.SAFETY_EVAL_BASE_URL || "http://localhost:3100";
if (!IN || !OUT) { console.error("사용법: --in <jsonl> --out <json>"); process.exit(2); }
const items = fs.readFileSync(IN, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const users = [];
async function newUser() {
  const email = `routecheck${Date.now()}${users.length}@mailinator.com`, password = "Tmp-" + Math.random().toString(36).slice(2) + "A1!";
  const { data: c, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const { data: s, error: e2 } = await anon.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  users.push(c.user.id); return s.session.access_token;
}
const out = {}; let token = await newUser(), used = 0;
try {
  for (const it of items) {
    if (used >= 15) { token = await newUser(); used = 0; } // 하루 20건 제한을 넘지 않게 계정을 바꿔 쓴다
    const res = await fetch(`${BASE}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-access-code": process.env.ACCESS_CODE_FOR_EVAL ?? "" }, body: JSON.stringify({ message: it.text, sessionId: null }) });
    used++;
    if (!res.ok) { out[it.id] = { error: res.status }; continue; }
    const d = await res.json(); out[it.id] = { route: d.route, source: d.source };
  }
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id);
  console.log(`임시 계정 ${users.length}개 삭제`);
}
fs.writeFileSync(OUT, JSON.stringify(out));
const by = {};
for (const it of items) { const r = out[it.id]?.route ?? "오류"; (by[it.set] ??= {})[r] = (by[it.set][r] ?? 0) + 1; }
for (const [s, m] of Object.entries(by)) console.log(s.padEnd(14), JSON.stringify(m));
