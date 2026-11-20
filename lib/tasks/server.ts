import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as RS from "@/lib/interp/vendor/rootState.mjs";
import * as CS from "@/lib/interp/vendor/case.mjs";
import * as PS from "@/lib/interp/vendor/personal.mjs";
import * as M from "@/lib/interp/vendor/motive.mjs";
import { growthReport } from "@/lib/interp/growth";
import { loadCardData } from "@/lib/cards/session";
import type { CardEnded } from "@/lib/cards/session";
import type { CardPayload, TaskCheckAnswer, TaskResult } from "@/lib/cards/flow";
import { mapOnboardingAnswers, onboardingEligible } from "@/lib/interp/onboardingInput";
import { loadTaskEngine } from "./data";
import {
  RESULT_ACK, TASK_LATER_REPLY, TASK_OFFER_ENDINGS, TASK_OFFER_TEXT, AFTER_TASK_PROMPT, MINI_LATER_REPLY, miniNowText, pathOptionIds, taskAskPayload, taskChosenReply, taskCheckPayload,
  taskCheckReply, taskMiniPayload, taskOfferPayload, taskOpeningPayload, type PlannedTask,
} from "./flow";

// 과제(작은 연습) 서버 흐름 — CSO 엔진 ssol_case v0.16 · ssol_personal v0.8, 엔진 안내 v3.2 · v3.9~v3.17.
// 3부-3(2026-11-18): 카드가 확인으로 끝나면 연습 두 개 → 고르면 저장 → 다음 대화 첫머리 "해 보니 어땠어요?" → 확인 답 → 장부(task)
// 3부-4(2026-11-19): 연습을 건네기 전에 엔진 질문을 하나씩(AI 없이 버튼) —
//   ① 겨루는 가설(끝 뿌리가 하나일 때 2위 가설과 견줌: 가르는 질문 또는 뿌리 예측 예·아니요) ② 여건(끝 뿌리가 없는 길: 엔진이 먼저 판단, 안 서면 "지나가는 일인지 되풀이되는 일인지")
//   ③ 대처 방식(카드 길·다른 고민·테스트로도 모를 때 한 번). 물은 것은 sw_user_disc_asked에 남겨 다시 묻지 않는다.
//   고른 뒤 ④ 지금 해 보기(1~3분짜리가 있으면 "지금 ○분만 같이 해 볼까요?" → 하면 바로 확인 질문 → 장부, 절반 점수).
// 진행 중인 질문은 그 대화의 sw_user_tasks 행 plan.pending에 둔다(연습을 건네기 전까지 offered는 빈 목록). 끄기: SW_TASKS=0. 실패하면 과제 없이 평소 대화.
type Admin = ReturnType<typeof createAdminClient>;
type States = Record<string, ReturnType<typeof RS.newRootState>>;
type TaskRow = Record<string, unknown> & { id: number; user_id: string; chat_id: string | null; concern_id: string | null; practice_id: string | null; result: string | null; plan: Record<string, unknown> | null; at: string };
type AskKind = "rival" | "condition" | "coping";
type PendingAsk = { kind: AskKind; group: string; ask: string; options: { text: string; value: string | null }[]; q: Record<string, unknown> };
type Pending = { path: string[]; sceneKey: string; route: string | null; reason: string; done: AskKind[]; cond: Record<string, unknown> | null; ask: PendingAsk | null };
type Person = Record<string, unknown> & { hasChild?: boolean };

export const tasksOn = () => process.env.SW_TASKS !== "0";
// 엔진 함수 이름(useCondition)이 React 훅 규칙(lint)에 걸려 이름만 바꿔 부른다 — 훅이 아니다.
const conditionToCandidates = PS.useCondition;

async function loadStates(admin: Admin, userId: string): Promise<States> {
  const { data, error } = await admin.rpc("sw_read_ledger", { p_user: userId });
  if (error) throw new Error(`sw_read_ledger ${error.code}`);
  return RS.hydrate(userId, data ?? [], []) as States;
}
async function applySink(admin: Admin, userId: string, sink: unknown[]): Promise<void> {
  if (!sink.length) return;
  const { error } = await admin.rpc("sw_apply_ops", { p_user: userId, p_ops: sink });
  if (error) throw new Error(`sw_apply_ops ${error.code}`);
}
async function userTasks(admin: Admin, userId: string): Promise<TaskRow[]> {
  const { data, error } = await admin.from("sw_user_tasks").select("*").eq("user_id", userId).is("hidden_at", null).order("at", { ascending: true }).limit(300);
  if (error) throw new Error(`sw_user_tasks 읽기 ${error.code}`);
  return (data ?? []) as TaskRow[];
}
async function concernRows(admin: Admin, userId: string) {
  const { data, error } = await admin.from("sw_user_concern_state").select("*").eq("user_id", userId).is("hidden_at", null);
  if (error) throw new Error(`sw_user_concern_state 읽기 ${error.code}`);
  return (data ?? []) as Record<string, unknown>[];
}
async function askedGroups(admin: Admin, userId: string): Promise<Set<string>> {
  const { data } = await admin.from("sw_user_disc_asked").select("group_id").eq("user_id", userId).is("hidden_at", null);
  return new Set((data ?? []).map((r) => String(r.group_id)));
}
async function noteAsked(admin: Admin, row: Record<string, unknown>): Promise<void> {
  const { error } = await admin.from("sw_user_disc_asked").upsert({ ...row, at: new Date().toISOString() }, { onConflict: "user_id,group_id" });
  if (error) console.warn("물은 질문 기록 실패:", error.code);
}
async function saveConcern(admin: Admin, cs: Record<string, unknown>): Promise<void> {
  const row = CS.concernStateToRow(cs) as Record<string, unknown>;
  const { error } = await admin.from("sw_user_concern_state").upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "user_id,concern_id" });
  if (error) throw new Error(`sw_user_concern_state 저장 ${error.code}`);
}
async function recentUserTexts(admin: Admin, userId: string, chatId: string): Promise<string[]> {
  const { data } = await admin.from("chat_messages").select("content").eq("user_id", userId).eq("session_id", chatId).eq("role", "user").order("created_at", { ascending: false }).limit(10);
  return (data ?? []).map((m) => String(m.content ?? "")).reverse();
}

// 개인 맞춤에 쓰는 사람 정보 — 온보딩 답(개인화 동의 + 끝낸 사용자만) · 쌓인 뿌리 상태 · 과제 기록 · 다른 고민.
// 3부-5(2026-11-20): + 그 장면 영역의 지금 동기 위치(MV-03 — 맞는 실천 +0.5) · 나를 넘어서는 신호 · 심리테스트 대처 방식(이탈형이면 대처 방식 짐작 '회피' — 짐작일 뿐 본인 답이 앞섬).
async function personOf(admin: Admin, userId: string, states: States, tasks: TaskRow[], concerns: Record<string, unknown>[], sceneKey: string | null = null): Promise<Person> {
  const [{ data: ob }, growth, { data: quiz }] = await Promise.all([
    admin.from("user_onboarding").select("*").eq("user_id", userId).maybeSingle(),
    growthReport(admin, userId).catch(() => null),
    admin.from("ssol_quiz_results").select("type_key").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(), // 다른 사이트 표 — 읽기만
  ]);
  const answers = onboardingEligible(ob) ? mapOnboardingAnswers(ob) : {};
  const motivePosition = sceneKey && growth ? (growth.motive[M.domainOf(sceneKey) as string] ?? null) : null;
  const testCoping = String(quiz?.type_key ?? "").split("-")[1] === "disengage" ? "disengage" : null;
  const base = { rootStates: states, tasks, concerns: concerns.map((r) => CS.concernStateFromRow(r)), motivePosition, beyondSignal: growth?.beyond ?? false, testCoping };
  return PS.withTaskTheory(PS.personFromOnboarding(answers, base), tasks) as Person;
}

// 한 고민의 과제 계산 재료(질문에 답할 때마다 장부가 바뀌므로 매번 새로 만든다).
async function buildCtx(admin: Admin, userId: string, chatId: string, pend: Pending) {
  const [engine, cardData, states, tasks, concerns, asked, { data: sess }] = await Promise.all([
    loadTaskEngine(admin), loadCardData(admin), loadStates(admin, userId), userTasks(admin, userId), concernRows(admin, userId), askedGroups(admin, userId),
    admin.from("chat_sessions").select("worry_pick").eq("session_id", chatId).maybeSingle(),
  ]);
  const person = await personOf(admin, userId, states, tasks, concerns, pend.sceneKey);
  const prev = concerns.find((r) => r.concern_id === pend.sceneKey);
  const cs = prev ? CS.concernStateFromRow(prev) : CS.newConcernState(userId, pend.sceneKey);
  const worry = (sess?.worry_pick ?? null) as { intent_id?: string | null; secondary?: string | null } | null;
  const rejected = Object.values(states).filter((s) => s?.status === "rejected").map((s) => s.root_id);
  const tc = CS.taskCandidates(pend.path, cardData.options, {
    intentId: worry?.intent_id ?? undefined, secondaryId: worry?.secondary ?? undefined, hasChild: person.hasChild, rejected, ruledOut: cs.ruled_out,
  }) as ReturnType<typeof CS.taskCandidates> & { route?: string; conditionRoot?: string | null };
  PS.addLadderCandidates(tc, person);
  if (pend.cond) conditionToCandidates(tc, pend.cond as never, engine.caseData as never); // 여건 질문 답(또는 엔진 판단)을 후보에 반영
  CS.applyCardPath(cs, pend.path, tc.roots, { confirmed: pend.reason === "confirmed", rootStates: states as never, person: person as never });
  PS.fillCoping(cs, person);
  return { engine, cardData, states, tasks, concerns, asked, person, cs, tc, rejected };
}
type Ctx = Awaited<ReturnType<typeof buildCtx>>;

// 다음 질문(없으면 null). 여건은 엔진이 먼저 판단하면 묻지 않고 바로 반영한다(sink·기록은 여기서).
async function nextAsk(admin: Admin, userId: string, chatId: string, ctx: Ctx, pend: Pending): Promise<PendingAsk | null> {
  const { cardData, tc, cs, asked, states, rejected } = ctx;
  if (!pend.done.includes("rival")) {
    pend.done.push("rival");
    const q = PS.rivalQuestion(pend.path, cardData.options, { ...tc, ruledOut: cs.ruled_out }, asked, rejected) as Record<string, unknown> | null;
    if (q) {
      const opts = (q.options as { text: string; root?: string | null; answer?: string | null }[]).map((o) => ({ text: o.text, value: (q.type === "discriminator" ? o.root : o.answer) ?? null }));
      return { kind: "rival", group: String(q.group), ask: String(q.ask), options: opts, q };
    }
  }
  if (!pend.done.includes("condition")) {
    pend.done.push("condition");
    const rc = PS.resolveCondition(pend.path, cardData.options, tc, { temporals: [], stageSignals: [], rootStates: states, sceneKey: pend.sceneKey,
      history: ctx.concerns.filter((r) => r.concern_id !== pend.sceneKey).map((r) => ({ concern_id: r.concern_id, roots: [] })), recentChange: false }, asked) as
      { judged?: Record<string, unknown> & { answer: string; group: string; roots: string[]; source: string; reasons: unknown }; question?: Record<string, unknown> } | null;
    if (rc?.judged) {
      const sink: unknown[] = [];
      pend.cond = PS.applyCondition(states, userId, rc.judged, rc.judged.answer, sink, chatId as never) as Record<string, unknown>;
      await applySink(admin, userId, sink);
      await noteAsked(admin, { user_id: userId, group_id: rc.judged.group, roots: rc.judged.roots, answer: rc.judged.answer, source: rc.judged.source, reasons: rc.judged.reasons, chat_id: chatId });
    } else if (rc?.question) {
      const q = rc.question;
      const opts = (q.options as { text: string; answer: string | null }[]).map((o) => ({ text: o.text, value: o.answer ?? null }));
      return { kind: "condition", group: String(q.group), ask: String(q.ask), options: opts, q };
    }
  }
  if (!pend.done.includes("coping")) {
    pend.done.push("coping");
    const group = `CQ:${pend.sceneKey}`;
    const q = PS.copingQuestion(cs, asked.has(group)) as { q_id: string; ask: string; options: { text: string; coping: string | null }[] } | null;
    if (q) return { kind: "coping", group, ask: q.ask, options: q.options.map((o) => ({ text: o.text, value: o.coping ?? null })), q: q as unknown as Record<string, unknown> };
  }
  return null;
}

// 질문이 끝나면 연습 두 개(엔진 pickTasks · 사람 점수 · 계획). 제목이 없는(검수 표에 없는) 실천은 뺀다.
async function pickPlanned(admin: Admin, userId: string, chatId: string, ctx: Ctx, pend: Pending): Promise<{ planned: PlannedTask[]; roots: string[] }> {
  const { engine, cs, tc, person } = ctx;
  const words = PS.wordsFrom(await recentUserTexts(admin, userId, chatId));
  const picked = CS.pickTasks(cs, tc.candidates, {
    fallback: tc.fallback, route: tc.route ?? pend.route ?? undefined, conditionRoot: tc.conditionRoot ?? undefined, relRoots: tc.relRoots, hasChild: person.hasChild,
    personal: PS.scorer(cs, person), formatOf: PS.sizeOf,
  });
  const planned = (PS.withPlans(picked, cs, tc.roots, words) as PlannedTask[])
    .filter((t) => engine.titles[t.practice_id])
    .map((t) => ({ ...t, plan: { ...(t.plan ?? {}), title: engine.titles[t.practice_id] } }));
  await saveConcern(admin, cs);
  return { planned, roots: tc.roots };
}

// 질문 또는 연습 카드를 이 행 기준으로 만든다(행의 plan을 함께 갱신).
async function advance(admin: Admin, userId: string, chatId: string, rowId: number, pend: Pending): Promise<CardPayload | null> {
  const ctx = await buildCtx(admin, userId, chatId, pend);
  const ask = await nextAsk(admin, userId, chatId, ctx, pend);
  if (ask) {
    pend.ask = ask;
    await saveConcern(admin, ctx.cs);
    const { error } = await admin.from("sw_user_tasks").update({ plan: { pending: pend } }).eq("id", rowId).eq("user_id", userId);
    if (error) throw new Error(`sw_user_tasks 질문 저장 ${error.code}`);
    return taskAskPayload(rowId, ask.ask, ask.options);
  }
  const { planned, roots } = await pickPlanned(admin, userId, chatId, ctx, pend);
  if (!planned.length) {
    await admin.from("sw_user_tasks").update({ plan: null, hidden_at: new Date().toISOString() }).eq("id", rowId).eq("user_id", userId); // 건넬 게 없음 — 기록에서 숨김
    return null;
  }
  const { error } = await admin.from("sw_user_tasks").update({ offered: planned.map((t) => t.practice_id), stage_at: ctx.cs.stage, coping_at: ctx.cs.coping, plan: { offered: planned, roots, scene: pend.sceneKey } }).eq("id", rowId).eq("user_id", userId);
  if (error) throw new Error(`sw_user_tasks 건넴 저장 ${error.code}`);
  return taskOfferPayload(rowId, planned);
}

export type TaskOfferPlan = { finalize: (usedFallback: boolean) => Promise<{ text: string; choices: []; card: CardPayload } | undefined> };

// ① 카드가 확인으로 끝나면: 이번 답변 뒤에 질문 카드 또는 연습 카드를 붙인다(실제 계산은 답변 저장 뒤 finalize에서 — 장부 쓰기가 답변 실패에 묶이지 않게).
export async function planTaskOffer(p: { admin: Admin; userId: string; sessionId: string; route: string; ended: CardEnded; recentUserTexts: string[] }): Promise<TaskOfferPlan | null> {
  if (!tasksOn() || !TASK_OFFER_ENDINGS.has(p.ended.reason) || !p.ended.sceneKey) return null;
  const path = pathOptionIds(p.ended.path);
  if (!path.length) return null;
  const sceneKey = p.ended.sceneKey;
  return {
    finalize: async (usedFallback) => {
      if (usedFallback) return undefined;
      try {
        const pend: Pending = { path, sceneKey, route: p.ended.route, reason: p.ended.reason, done: [], cond: null, ask: null };
        const base = { user_id: p.userId, chat_id: p.sessionId, concern_id: sceneKey, offered: [], practice_id: null, path: null, result: null, at: new Date().toISOString() };
        const { data: ins, error } = await p.admin.from("sw_user_tasks").insert({ ...base, plan: { pending: pend } }).select("id").single();
        if (error || !ins) { console.warn("과제 행 만들기 실패:", error?.code); return undefined; }
        const card = await advance(p.admin, p.userId, p.sessionId, Number(ins.id), pend);
        if (!card) return undefined;
        const { error: me } = await p.admin.from("chat_messages").insert({
          session_id: p.sessionId, user_id: p.userId, role: "assistant", content: card.text, route: p.route, reflection_signal_id: `sw-task:${card.kind}:${ins.id}`,
        });
        if (me) return undefined;
        return { text: card.text, choices: [], card };
      } catch (e) {
        console.warn("과제 고르기 실패, 과제 없이 진행:", e instanceof Error ? e.message.slice(0, 120) : "unknown");
        return undefined;
      }
    },
  };
}

async function ownRow(admin: Admin, userId: string, id: number): Promise<TaskRow | null> {
  const { data } = await admin.from("sw_user_tasks").select("*").eq("id", id).eq("user_id", userId).is("hidden_at", null).maybeSingle();
  return (data as TaskRow | null) ?? null;
}
const offeredOf = (row: TaskRow): PlannedTask[] => (Array.isArray((row.plan as { offered?: unknown } | null)?.offered) ? ((row.plan as { offered: PlannedTask[] }).offered) : []);

export type TaskReply = { text: string; card?: CardPayload };

// 연습 전 질문에 답했을 때: 답을 장부·고민 상태·물은 기록에 넣고 다음 질문 또는 연습 카드.
export async function answerTaskAsk(admin: Admin, userId: string, chatId: string, pick: { row: number; option: number }): Promise<TaskReply | null> {
  const row = await ownRow(admin, userId, pick.row);
  const pend = (row?.plan as { pending?: Pending } | null)?.pending;
  if (!row || row.practice_id || !pend?.ask || row.chat_id !== chatId) return null;
  const opt = pend.ask.options[pick.option];
  if (!opt) return null;
  await loadTaskEngine(admin);
  const ask = pend.ask;
  if (ask.kind === "coping") {
    const concerns = await concernRows(admin, userId);
    const prev = concerns.find((r) => r.concern_id === pend.sceneKey);
    const cs = prev ? CS.concernStateFromRow(prev) : CS.newConcernState(userId, pend.sceneKey);
    PS.applyCopingAnswer(cs, opt.value);
    await saveConcern(admin, cs);
    await noteAsked(admin, { user_id: userId, group_id: ask.group, roots: [], answer: opt.value ?? "mixed", source: "asked", chat_id: chatId });
  } else {
    const states = await loadStates(admin, userId);
    const sink: unknown[] = [];
    if (ask.kind === "rival") {
      const res = PS.applyRival(states, userId, ask.q as never, opt.value as never, sink, chatId as never) as { ruled_out?: string | null };
      await applySink(admin, userId, sink);
      if (res?.ruled_out) {
        const concerns = await concernRows(admin, userId);
        const prev = concerns.find((r) => r.concern_id === pend.sceneKey);
        const cs = prev ? CS.concernStateFromRow(prev) : CS.newConcernState(userId, pend.sceneKey);
        PS.noteRuledOut(cs, res);
        await saveConcern(admin, cs);
      }
      const roots = (ask.q.roots as string[]) ?? [];
      await noteAsked(admin, { user_id: userId, group_id: ask.group, roots, ...(ask.q.type === "discriminator" ? { answer_root: opt.value } : { answer: opt.value }), source: "asked", chat_id: chatId });
    } else {
      pend.cond = PS.applyCondition(states, userId, ask.q as never, opt.value as never, sink, chatId as never) as Record<string, unknown>;
      await applySink(admin, userId, sink);
      await noteAsked(admin, { user_id: userId, group_id: ask.group, roots: (ask.q.roots as string[]) ?? [], answer: opt.value, source: "asked", chat_id: chatId });
    }
  }
  pend.ask = null;
  const card = await advance(admin, userId, chatId, row.id, pend);
  return card ? { text: card.text, card } : { text: "알려 줘서 고마워요. 하고 싶은 이야기가 있으면 이어서 들려주세요." };
}

// ② 건넨 과제 중 하나를 골랐을 때(또는 "지금은 괜찮아요"). 고르면 지금 짧게 해 볼 것이 있는지(miniExperiment)도 본다.
export async function chooseTask(admin: Admin, userId: string, pick: { row: number; practice: string }): Promise<TaskReply | null> {
  const row = await ownRow(admin, userId, pick.row);
  if (!row || row.practice_id) return null; // 남의 행·이미 고른 행
  if (pick.practice === "later") return { text: TASK_LATER_REPLY }; // 고르지 않음 = practice_id 빈 채로 둠(엔진 historyOf가 "고르지 않음"으로 셈)
  const t = offeredOf(row).find((x) => x.practice_id === pick.practice);
  if (!t) return null;
  const engine = await loadTaskEngine(admin);
  const fields = PS.taskPlanFields(t) as Record<string, unknown>;
  const roots = ((row.plan as { roots?: string[] } | null)?.roots ?? []) as string[];
  const reply = taskChosenReply(t);
  // 지금 해 보기: 고른 것이 1~3분짜리면 그것, 아니면 같은 뿌리의 맛보기 실천(엔진 v0.6). 실패해도 고른 것은 저장한다.
  let mini: Record<string, unknown> | null = null;
  try {
    const [states, tasks, concerns] = await Promise.all([loadStates(admin, userId), userTasks(admin, userId), concernRows(admin, userId)]);
    const person = await personOf(admin, userId, states, tasks, concerns, row.concern_id);
    const prev = concerns.find((r) => r.concern_id === row.concern_id);
    const cs = prev ? CS.concernStateFromRow(prev) : null;
    mini = PS.miniExperiment([t], cs, roots, person) as Record<string, unknown> | null;
    if (mini && !engine.titles[String(mini.practice_id)]) mini = null;
  } catch {
    mini = null;
  }
  const plan = { ...(t.plan ?? {}), offered: offeredOf(row).map((x) => x.practice_id), roots, ...(mini ? { mini } : {}) };
  const { error } = await admin.from("sw_user_tasks").update({ practice_id: t.practice_id, ...fields, plan }).eq("id", row.id).eq("user_id", userId);
  if (error) throw new Error(`sw_user_tasks 고름 저장 ${error.code}`);
  if (!mini) return { text: reply };
  const card = taskMiniPayload(row.id, reply, String(mini.invite), String(mini.title), mini.practice_id === t.practice_id);
  return { text: card.text, card };
}

// ④ "지금 해 볼게요" → 바로 확인 질문(대화 안에서 한 확인은 절반 점수 — in_session) · "나중에 할게요" → 그대로.
export async function answerTaskMini(admin: Admin, userId: string, chatId: string, pick: { row: number; choice: "now" | "later" }): Promise<TaskReply | null> {
  const row = await ownRow(admin, userId, pick.row);
  const mini = (row?.plan as { mini?: Record<string, unknown> } | null)?.mini;
  if (!row || !row.practice_id || !mini || (row.plan as { mini_answered?: boolean }).mini_answered) return null;
  await admin.from("sw_user_tasks").update({ plan: { ...row.plan, mini_answered: true } }).eq("id", row.id).eq("user_id", userId);
  if (pick.choice === "later") return { text: MINI_LATER_REPLY };
  const check = mini.check as { question: string; options: string[] };
  const minutes = typeof mini.minutes === "number" ? mini.minutes : null;
  let checkRow = row.id;
  if (mini.practice_id !== row.practice_id) {
    // 맛보기는 고른 연습과 따로 한 줄(대화 안에서 함 · 결과는 다 함 — 다음 대화 첫머리에는 고른 연습만 묻는다).
    const { data: ins, error } = await admin.from("sw_user_tasks").insert({
      user_id: userId, chat_id: chatId, concern_id: row.concern_id, offered: [mini.practice_id], practice_id: mini.practice_id, in_session: true, result: "다 함", result_chat_id: chatId,
      result_at: new Date().toISOString(), check_root: (mini.row as { check_root?: string | null })?.check_root ?? null, check_direct: true, at: new Date().toISOString(),
      plan: { title: mini.title, minutes: mini.minutes, first_step: mini.first_step, extra: true },
    }).select("id").single();
    if (error || !ins) throw new Error(`sw_user_tasks 맛보기 저장 ${error?.code}`);
    checkRow = Number(ins.id);
  } else {
    await admin.from("sw_user_tasks").update({ in_session: true, result: "다 함", result_chat_id: chatId, result_at: new Date().toISOString() }).eq("id", row.id).eq("user_id", userId);
  }
  const card = taskCheckPayload(checkRow, "", check.question, check.options);
  const text = `${miniNowText(String(mini.title), minutes, (mini.first_step as string | null) ?? null)}\n\n${check.question}`;
  return { text, card: { ...card, text } };
}

// ③ 다음 대화 첫머리: 고르고 결과가 없는 가장 최근 과제(30일 안 · 대화 안에서 한 맛보기 제외). 없으면 null.
const OPENING_DAYS = 30;
export async function taskOpening(admin: Admin, userId: string): Promise<CardPayload | null> {
  if (!tasksOn()) return null;
  const since = new Date(Date.now() - OPENING_DAYS * 86400000).toISOString();
  const { data, error } = await admin.from("sw_user_tasks").select("*").eq("user_id", userId).is("hidden_at", null).not("practice_id", "is", null).is("result", null).gte("at", since).order("at", { ascending: true }).limit(50);
  if (error || !data?.length) return null;
  const op = CS.openingFor(data) as { task: TaskRow; text: string } | null;
  if (!op) return null;
  const title = typeof op.task.plan?.title === "string" ? op.task.plan.title : null;
  return taskOpeningPayload(Number(op.task.id), op.text, title);
}

// 결과 답(다 했어요 · 조금 했어요 · 못 했어요). 해 봤으면 확인 질문 카드, 못 했으면 탓하지 않는 말로 끝.
export async function recordTaskResult(admin: Admin, userId: string, chatId: string, pick: { row: number; result: TaskResult }): Promise<TaskReply | null> {
  const row = await ownRow(admin, userId, pick.row);
  if (!row || !row.practice_id || row.result) return null;
  await loadTaskEngine(admin);
  const { row: next, ack } = CS.taskResult(row, pick.result, chatId) as { row: TaskRow; ack: "did" | "effort" | "no_blame" };
  const { error } = await admin.from("sw_user_tasks").update({ result: next.result, result_chat_id: chatId, result_at: next.result_at }).eq("id", row.id).eq("user_id", userId);
  if (error) throw new Error(`sw_user_tasks 결과 저장 ${error.code}`);
  if (ack === "no_blame") return { text: `${RESULT_ACK.no_blame}\n\n${AFTER_TASK_PROMPT}` };
  const check = PS.checkFor({ root: row.check_root, root_direct: row.check_direct !== false, stage: row.task_stage }) as { question: string; options: string[] };
  return { text: "", card: taskCheckPayload(row.id, RESULT_ACK[ack], check.question, check.options) };
}

// 확인 답 → 장부(출처 task) · 고민 단계 신호. 같은 뿌리에 "그대로예요"가 두 번이면 엔진이 그 가설을 낮춘다.
export async function recordTaskCheck(admin: Admin, userId: string, chatId: string, pick: { row: number; answer: TaskCheckAnswer }): Promise<TaskReply | null> {
  const row = await ownRow(admin, userId, pick.row);
  if (!row || !row.result || row.check_answer) return null;
  await loadTaskEngine(admin);
  const [states, tasks, concerns] = await Promise.all([loadStates(admin, userId), userTasks(admin, userId), concernRows(admin, userId)]);
  const sink: unknown[] = [];
  const out = PS.applyTaskCheck(states, userId, { ...row, result_chat_id: row.result_chat_id ?? chatId }, pick.answer, sink, tasks) as { row: TaskRow };
  await applySink(admin, userId, sink);
  const { error } = await admin.from("sw_user_tasks").update({ check_answer: out.row.check_answer, check_at: out.row.check_at }).eq("id", row.id).eq("user_id", userId);
  if (error) throw new Error(`sw_user_tasks 확인 저장 ${error.code}`);
  const sig = PS.taskStageSignals({ ...row, check_answer: pick.answer }, pick.answer) as unknown[];
  const prev = concerns.find((r) => r.concern_id === row.concern_id);
  if (sig.length && prev) {
    const cs = CS.concernStateFromRow(prev);
    CS.addStageSignals(cs, sig, chatId as never);
    await saveConcern(admin, cs).catch(() => undefined);
  }
  return { text: taskCheckReply(pick.answer) };
}

export { TASK_OFFER_TEXT };
