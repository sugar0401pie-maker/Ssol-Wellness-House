// 회원 탈퇴(2026-11-19, 쏘웰라 정보만 삭제) 실전 확인 — 떠 있는 dev 서버(포트 3100)에 진짜 요청을 보낸다.
// 임시 계정으로 대화 한 번 + 프로필 값을 넣고 → /api/account/withdraw → 쏘웰라 기록이 0인지 · 프로필이 비었는지 · 계정은 남았는지 본다. 끝나면 계정 삭제.
// 실행: node --env-file=.env.local scripts/withdraw-e2e.mjs
// 화면 확인용: WITHDRAW_E2E_KEEP=<파일 경로>면 탈퇴 전에 멈추고 계정을 남긴다(로그인 정보는 그 파일에만). 지우기: WITHDRAW_E2E_DELETE=<user id>
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

const BASE_URL = process.env.WITHDRAW_E2E_BASE_URL || "http://localhost:3100";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
if (process.env.WITHDRAW_E2E_DELETE) {
  const { error } = await admin.auth.admin.deleteUser(process.env.WITHDRAW_E2E_DELETE);
  console.log(error ? `삭제 실패: ${error.message}` : "임시 계정 삭제함");
  process.exit(0);
}
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const email = `withdrawe2e${Date.now()}@mailinator.com`;
const password = "Tmp-" + Math.random().toString(36).slice(2) + "A1!";
const { data: created, error: ce } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (ce || !created?.user) { console.error("임시 계정 생성 실패:", ce?.message); process.exit(1); }
const userId = created.user.id;
const TABLES = ["chat_sessions", "chat_messages", "sw_evidence_events", "sw_user_root_state", "user_onboarding", "customer_feedback"];
const counts = async () => Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, (await admin.from(t).select("*", { count: "exact", head: true }).eq("user_id", userId)).count])));
let keep = false;
try {
  const { data: si, error: se } = await anon.auth.signInWithPassword({ email, password });
  if (se || !si.session) throw new Error("임시 계정 로그인 실패");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${si.session.access_token}`, "x-access-code": process.env.ACCESS_CODE_FOR_EVAL ?? "" };
  await fetch(`${BASE_URL}/api/chat`, { method: "POST", headers, body: JSON.stringify({ message: "요즘 회사 일이 많아서 좀 지쳐요" }) });
  await admin.from("profiles").update({ display_name: "테스트", nickname: "탈퇴시험", phone: "010-0000-0000", address: "서울시 어딘가", terms_agreed_at: new Date().toISOString(), trial_started_at: new Date().toISOString() }).eq("user_id", userId);
  await admin.from("customer_feedback").insert({ user_id: userId, message: "시험용 의견" }).then(() => undefined, () => undefined);
  console.log("탈퇴 전:", JSON.stringify(await counts()));
  if (process.env.WITHDRAW_E2E_KEEP) { writeFileSync(process.env.WITHDRAW_E2E_KEEP, JSON.stringify({ email, password, userId })); keep = true; console.log(`화면 확인용으로 계정을 남김(user ${userId})`); process.exit(0); }
  const r = await fetch(`${BASE_URL}/api/account/withdraw`, { method: "POST", headers });
  console.log("탈퇴 응답:", r.status, JSON.stringify(await r.json()));
  console.log("탈퇴 후:", JSON.stringify(await counts()));
  const { data: p } = await admin.from("profiles").select("display_name, nickname, phone, address, terms_agreed_at, trial_started_at").eq("user_id", userId).maybeSingle();
  console.log("프로필:", JSON.stringify(p));
  const { data: u } = await admin.auth.admin.getUserById(userId);
  console.log("계정 남아 있음:", !!u?.user);
  const r2 = await fetch(`${BASE_URL}/api/account/withdraw`, { method: "POST", headers: { ...headers, Authorization: "Bearer x" } });
  console.log("로그인 없이 탈퇴 요청:", r2.status);
} finally {
  if (!keep) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.warn("임시 계정 정리 실패(수동 확인 필요):", error.message);
  }
}
