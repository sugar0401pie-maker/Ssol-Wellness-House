// 첫 말 → 세부 고민 → 갈래(까닭) 카드 → 과제(2026-11-23 CSO 묶음 v2.32) 실전 확인 — 떠 있는 dev 서버(포트 3100)에 진짜 요청을 보낸다.
// 실행: node --env-file=.env.local scripts/branch-e2e.mjs "<첫 말>" [고를 보기 순번(0부터) — 기본 0]
// 갈래 카드가 나오면 그 보기를 고르고, 이어지는 카드(장면 카드·과제 질문)는 첫 보기로 답해 연습 카드까지 따라간다(최대 6번).
// 임시 계정(mailinator)을 만들어 쓰고 끝나면 대화와 함께 삭제한다(scripts/worry-e2e.mjs와 같은 방식). 비용: 대화당 몇 원.
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.WORRY_E2E_BASE_URL || "http://localhost:3100";
const FIRST = process.argv[2] || "회사를 그만둘까 고민이에요";
const PICK = Number(process.argv[3] ?? 0);

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const email = `branche2e${Date.now()}@mailinator.com`;
const password = "Tmp-" + Math.random().toString(36).slice(2) + "A1!";
const { data: created, error: ce } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (ce || !created?.user) { console.error("임시 계정 생성 실패:", ce?.message); process.exit(1); }
const userId = created.user.id;
const pickFor = (card, i) => {
  const o = card.options[Math.min(i, card.options.length - 1)];
  if (card.kind === "branch") return [{ branch: { option: o.id } }, o.label];
  if (card.kind === "task_ask") return [{ taskAsk: { row: card.row, option: Number(o.id) } }, o.label];
  if (card.kind === "task") return null; // 연습 카드에서 멈춤
  if (card.kind === "confirm") return [{ confirm: o.id }, o.label];
  if (card.kind === "scope") return [{ scope: o.id }, o.label];
  if (card.kind === "card") return [{ cardId: card.cardId, optionId: o.id }, o.label];
  return null;
};
try {
  const { data: si, error: se } = await anon.auth.signInWithPassword({ email, password });
  if (se || !si.session) throw new Error("임시 계정 로그인 실패");
  const send = async (body) => {
    const r = await fetch(`${BASE_URL}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${si.session.access_token}`, "x-access-code": process.env.ACCESS_CODE_FOR_EVAL ?? "" }, body: JSON.stringify(body) });
    return r.json();
  };
  const a = await send({ message: FIRST });
  const sessionId = a.sessionId;
  const { data: s } = await admin.from("chat_sessions").select("worry_pick").eq("session_id", sessionId).maybeSingle();
  const wp = s?.worry_pick ?? {};
  console.log(`“${FIRST}” → ${a.route}\n 세부 고민 ${wp.intent_id ?? "-"} · 갈래 ${wp.branch_id ?? "-"}(${wp.branch_known ? "앎" : "모름"} · ${wp.branch_by ?? "-"})\n 답: ${a.reply}`);
  let card = a.followUp?.card ?? a.card ?? null;
  for (let step = 0; card && step < 6; step++) {
    console.log(`\n [${card.kind}] ${card.text}\n   ${card.options.map((o) => `${o.id}: ${o.label}`).join("\n   ")}`);
    const p = pickFor(card, card.kind === "branch" && step === 0 ? PICK : 0);
    if (!p) break;
    console.log(`  → 고름: ${p[1]}`);
    const r = await send({ message: p[1], sessionId, cardPick: p[0] });
    console.log(`  답: ${r.reply}`);
    card = r.card ?? r.followUp?.card ?? null;
  }
  const { data: s2 } = await admin.from("chat_sessions").select("worry_pick").eq("session_id", sessionId).maybeSingle();
  console.log(`\n 끝난 뒤 갈래: ${s2?.worry_pick?.branch_id ?? "-"} (${s2?.worry_pick?.branch_by ?? "-"})`);
} finally {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) console.warn("임시 계정 정리 실패(수동 확인 필요):", error.message);
}
