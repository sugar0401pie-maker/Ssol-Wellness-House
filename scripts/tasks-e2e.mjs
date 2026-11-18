// 작은 연습(과제) 흐름(2026-11-18 3부-3) 실전 확인 — 떠 있는 dev 서버(포트 3100)에 진짜 요청을 보낸다.
// 카드 → 확인(딱 내 마음이에요) → 범위 → 연습 두 가지 → 하나 고름 → 새 대화 첫머리 "해 보니 어땠어요?" → 조금 했어요 → 확인 답 → 장부·과제 기록 확인.
// 실행: node --env-file=.env.local scripts/tasks-e2e.mjs
// 화면 확인용: TASKS_E2E_KEEP=<파일 경로>면 연습을 고른 데서 멈추고 계정을 지우지 않는다(로그인 정보는 그 파일에만 — 화면 확인 뒤 TASKS_E2E_DELETE=<user id>로 지운다).
// 임시 계정(mailinator)을 만들어 쓰고 끝나면 삭제한다(scripts/safety-eval.mjs와 같은 방식). 비용: AI 답 몇 번(몇 원).
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

const BASE_URL = process.env.TASKS_E2E_BASE_URL || "http://localhost:3100";
const FIRST = process.argv[2] || "회사 그만두고 싶은데 너무 지쳐요";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
if (process.env.TASKS_E2E_DELETE) {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.admin.deleteUser(process.env.TASKS_E2E_DELETE);
  console.log(error ? `삭제 실패: ${error.message}` : "임시 계정 삭제함");
  process.exit(0);
}
const KEEP = process.env.TASKS_E2E_KEEP || null;
const email = `taskse2e${Date.now()}@mailinator.com`;
const password = "Tmp-" + Math.random().toString(36).slice(2) + "A1!";
const { data: created, error: ce } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (ce || !created?.user) { console.error("임시 계정 생성 실패:", ce?.message); process.exit(1); }
const userId = created.user.id;
const log = (...a) => console.log(...a);
try {
  const { data: si, error: se } = await anon.auth.signInWithPassword({ email, password });
  if (se || !si.session) throw new Error("임시 계정 로그인 실패");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${si.session.access_token}`, "x-access-code": process.env.ACCESS_CODE_FOR_EVAL ?? "" };
  const send = async (message, sessionId, cardPick) => {
    const r = await fetch(`${BASE_URL}/api/chat`, { method: "POST", headers, body: JSON.stringify({ message, sessionId, ...(cardPick ? { cardPick } : {}) }) });
    return r.json();
  };
  let a = await send(FIRST);
  const sid = a.sessionId;
  log(`첫 말 → ${a.route}\n 답: ${a.reply?.slice(0, 120)}…`);
  let card = a.followUp?.card ?? a.card;
  for (let i = 0; i < 8 && card; i++) {
    let pick, label;
    if (card.kind === "card") { const o = card.options[0]; pick = { cardId: card.cardId, optionId: o.id }; label = o.label; }
    else if (card.kind === "confirm") { const o = card.options.find((x) => x.id === "CF-A") ?? card.options[0]; pick = { confirm: o.id }; label = o.label; }
    else if (card.kind === "scope") { const o = card.options.find((x) => x.id === "CS-2") ?? card.options[0]; pick = { scope: o.id }; label = o.label; }
    else break;
    log(` [${card.kind}] ${card.text.slice(0, 60)} → “${label}”`);
    a = await send(label, sid, pick);
    card = a.card ?? a.followUp?.card;
    if (!a.card && a.followUp?.card) log(` 답: ${a.reply?.slice(0, 200)}`);
  }
  if (card?.kind !== "task") { log(" ✖ 연습 카드가 나오지 않음:", card?.kind ?? "(카드 없음)"); process.exitCode = 1; }
  else {
    log(` [task] ${card.text}\n   ${card.options.map((o) => `${o.id} · ${o.label}`).join("\n   ")}`);
    const t = card.options[0];
    a = await send(t.label, sid, { task: { row: card.row, practice: t.id } });
    log(` 고름 → ${a.reply}`);
    if (KEEP) { writeFileSync(KEEP, JSON.stringify({ email, password, userId })); log(`화면 확인용으로 계정을 남김(user ${userId})`); process.exit(0); }
    // 새 대화 첫머리
    const op = await (await fetch(`${BASE_URL}/api/tasks/opening`, { headers })).json();
    log(`\n새 대화 첫머리: ${op.opening?.text ?? "(없음)"}`);
    if (op.opening) {
      a = await send("조금 했어요", undefined, { taskResult: { row: op.opening.row, result: "조금" } });
      log(` 조금 했어요 → ${a.reply}`);
      if (a.card?.kind === "task_check") {
        a = await send("조금 나아졌어요", a.sessionId, { taskCheck: { row: a.card.row, answer: "조금 나아졌어요" } });
        log(` 조금 나아졌어요 → ${a.reply}`);
      }
      const { data: msgs } = await admin.from("chat_messages").select("role, content").eq("session_id", a.sessionId).order("created_at");
      log(` 새 대화 저장 순서: ${msgs?.map((m) => `${m.role}:${m.content.slice(0, 14)}`).join(" | ")}`);
    }
  }
  const { data: rows } = await admin.from("sw_user_tasks").select("id, concern_id, offered, practice_id, result, check_root, check_direct, check_answer, task_stage, format").eq("user_id", userId);
  log(`\nsw_user_tasks: ${JSON.stringify(rows)}`);
  const { data: cs } = await admin.from("sw_user_concern_state").select("concern_id, theory, stage, coping, layers_filled, stage_signals").eq("user_id", userId);
  log(`sw_user_concern_state: ${JSON.stringify(cs)}`);
  const { data: ledger } = await admin.rpc("sw_read_ledger", { p_user: userId });
  log(`장부 'task' 근거: ${JSON.stringify((ledger ?? []).filter((e) => JSON.stringify(e).includes('"task"')).slice(0, 3))}`);
} finally {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) console.warn("임시 계정 정리 실패(수동 확인 필요):", error.message);
}
