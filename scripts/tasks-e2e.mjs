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
  for (let i = 0; i < 12 && card; i++) {
    let pick, label;
    if (card.kind === "task_ask") { // 3부-4: 연습 전 질문 — 보기 마지막에서 두 번째(보통 "되풀이"·"둘 다" 쪽)가 아니라 첫 보기
      const o = card.options[0]; log(` [task_ask] ${card.text} → “${o.label}”  (보기: ${card.options.map((x) => x.label).join(" / ")})`);
      a = await send(o.label, sid, { taskAsk: { row: card.row, option: Number(o.id) } }); card = a.card ?? a.followUp?.card; continue;
    }
    if (card.kind === "card") { const o = card.options[Math.min(Number(process.env.TASKS_E2E_PICK ?? 0), card.options.length - 1)]; pick = { cardId: card.cardId, optionId: o.id }; label = o.label; }
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
    if (a.card?.kind === "task_mini") {
      const m = await send("지금 해 볼게요", sid, { taskMini: { row: a.card.row, choice: "now" } });
      log(` 지금 해 볼게요 → ${m.reply}`);
      if (m.card?.kind === "task_check") { const c = await send("조금 나아졌어요", sid, { taskCheck: { row: m.card.row, answer: "조금 나아졌어요" } }); log(` (바로) 조금 나아졌어요 → ${c.reply}`); }
    }
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
  // "지금 같이 해 보기" 분기(맛보기가 고른 연습과 다를 때): 검수된 1~3분 실천을 맛보기로 단 고른 행을 하나 넣고 진짜 API로 누른다(검수된 맛보기 실천이 아직 적어 카드 길에서는 잘 안 나옴).
  if (sid) {
    const { data: mrow } = await admin.from("sw_user_tasks").insert({ user_id: userId, chat_id: sid, concern_id: "job_change", offered: ["RPD-3010"], practice_id: "RPD-3010", at: new Date().toISOString(),
      plan: { title: "예전에 들은 말과 지금의 나 두 칸에 적기", mini: { practice_id: "RP-037", title: "'늘·전부'를 '이번에·이 부분'으로 바꿔 말하기", minutes: 3, invite: "지금 3분만 같이 해 볼까요?", first_step: null,
        check: { question: "해 보니, 조금 덜 단정하게 느껴졌나요?", options: ["조금 나아졌어요", "그대로예요", "더 버거웠어요", "잘 모르겠어요"] }, row: { in_session: true, check_root: "ROOT-56" } } } }).select("id").single();
    const m = await send("지금 해 볼게요", sid, { taskMini: { row: mrow.id, choice: "now" } });
    log(`\n[맛보기] 지금 해 볼게요 → ${m.reply}\n 카드: ${m.card?.kind} ${m.card?.options?.map((o) => o.label).join(" / ")}`);
    if (m.card?.kind === "task_check") { const c = await send("조금 나아졌어요", sid, { taskCheck: { row: m.card.row, answer: "조금 나아졌어요" } }); log(` 조금 나아졌어요 → ${c.reply}`); }
    const again = await send("지금 해 볼게요", sid, { taskMini: { row: mrow.id, choice: "now" } });
    log(` 같은 버튼 다시 → ${again.card ? "카드가 또 나옴(문제)" : "평소 대화로 넘어감(정상)"}`);
  }
  const { data: rows } = await admin.from("sw_user_tasks").select("id, concern_id, offered, practice_id, result, check_root, check_direct, check_answer, task_stage, format, in_session").eq("user_id", userId);
  const { data: asked } = await admin.from("sw_user_disc_asked").select("group_id, roots, answer, answer_root, source").eq("user_id", userId);
  log(`sw_user_disc_asked: ${JSON.stringify(asked)}`);
  log(`\nsw_user_tasks: ${JSON.stringify(rows)}`);
  const { data: cs } = await admin.from("sw_user_concern_state").select("concern_id, theory, stage, coping, layers_filled, stage_signals").eq("user_id", userId);
  log(`sw_user_concern_state: ${JSON.stringify(cs)}`);
  const { data: ledger } = await admin.rpc("sw_read_ledger", { p_user: userId });
  log(`장부 'task' 근거: ${JSON.stringify((ledger ?? []).filter((e) => JSON.stringify(e).includes('"task"')).slice(0, 3))}`);
} finally {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) console.warn("임시 계정 정리 실패(수동 확인 필요):", error.message);
}
