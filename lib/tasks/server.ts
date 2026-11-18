import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as RS from "@/lib/interp/vendor/rootState.mjs";
import * as CS from "@/lib/interp/vendor/case.mjs";
import * as PS from "@/lib/interp/vendor/personal.mjs";
import { loadCardData } from "@/lib/cards/session";
import type { CardEnded } from "@/lib/cards/session";
import type { CardPayload, TaskCheckAnswer, TaskResult } from "@/lib/cards/flow";
import { mapOnboardingAnswers, onboardingEligible } from "@/lib/interp/onboardingInput";
import { loadTaskEngine } from "./data";
import {
  RESULT_ACK, TASK_LATER_REPLY, TASK_OFFER_ENDINGS, AFTER_TASK_PROMPT, pathOptionIds, taskChosenReply, taskCheckPayload, taskCheckReply, taskOfferPayload, taskOpeningPayload,
  type PlannedTask,
} from "./flow";

// 과제(작은 연습) 서버 흐름 — CSO 엔진 ssol_case v0.16 · ssol_personal v0.8, 엔진 안내 v3.2 · v3.9 · v3.11 · v3.16(2026-11-18 3부-3).
// ① 카드가 확인으로 끝나면: 고민 상태(sw_user_concern_state) → 후보(taskCandidates · 세부 고민 해결책 · 사다리) → 이론·대처 방식 → pickTasks(사람 점수) → withPlans → 두 개를 건넴
// ② 고르면 sw_user_tasks 행에 고른 실천·계획·확인 뿌리 저장(taskChosen + taskPlanFields) ③ 다음 대화 첫머리 openingFor → 결과 → 해 봤으면 확인 질문 → applyTaskCheck(장부 'task')
// 아직 하지 않는 것(3부-4): 겨루는 가설·여건 질문·대처 방식 질문·지금 해 보기. 끄기: SW_TASKS=0(카드 기능이 꺼진 사용자도 안 함). 실패하면 과제 없이 평소 대화.
type Admin = ReturnType<typeof createAdminClient>;
type States = Record<string, ReturnType<typeof RS.newRootState>>;
type TaskRow = Record<string, unknown> & { id: number; user_id: string; practice_id: string | null; result: string | null; plan: Record<string, unknown> | null; at: string };

export const tasksOn = () => process.env.SW_TASKS !== "0";

async function loadStates(admin: Admin, userId: string): Promise<States> {
  const { data, error } = await admin.rpc("sw_read_ledger", { p_user: userId });
  if (error) throw new Error(`sw_read_ledger ${error.code}`);
  return RS.hydrate(userId, data ?? [], []) as States;
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
async function saveConcern(admin: Admin, cs: Record<string, unknown>): Promise<void> {
  const row = CS.concernStateToRow(cs) as Record<string, unknown>;
  const { error } = await admin.from("sw_user_concern_state").upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "user_id,concern_id" });
  if (error) throw new Error(`sw_user_concern_state 저장 ${error.code}`);
}

// 개인 맞춤에 쓰는 사람 정보 — 온보딩 답(개인화 동의 + 끝낸 사용자만) · 쌓인 뿌리 상태 · 과제 기록 · 다른 고민.
async function personOf(admin: Admin, userId: string, states: States, tasks: TaskRow[], concerns: Record<string, unknown>[]) {
  const { data: ob } = await admin.from("user_onboarding").select("*").eq("user_id", userId).maybeSingle();
  const answers = onboardingEligible(ob) ? mapOnboardingAnswers(ob) : {};
  const base = { rootStates: states, tasks, concerns: concerns.map((r) => CS.concernStateFromRow(r)) };
  return PS.withTaskTheory(PS.personFromOnboarding(answers, base), tasks) as Record<string, unknown> & { hasChild?: boolean };
}

export type TaskOfferPlan = { finalize: (usedFallback: boolean) => Promise<{ text: string; choices: []; card: CardPayload } | undefined> };

// ① 카드 끝에서 과제 두 개를 고른다(답변 생성 전에 계산 — 고를 게 있을 때만 AI 답을 "연습이 이어진다"에 맞춘다). 고를 게 없으면 null.
export async function planTaskOffer(p: { admin: Admin; userId: string; sessionId: string; route: string; ended: CardEnded; recentUserTexts: string[] }): Promise<TaskOfferPlan | null> {
  if (!tasksOn() || !TASK_OFFER_ENDINGS.has(p.ended.reason) || !p.ended.sceneKey) return null;
  try {
    const [engine, cardData, states, tasks, concerns, { data: sess }] = await Promise.all([
      loadTaskEngine(p.admin), loadCardData(p.admin), loadStates(p.admin, p.userId), userTasks(p.admin, p.userId), concernRows(p.admin, p.userId),
      p.admin.from("chat_sessions").select("worry_pick").eq("session_id", p.sessionId).maybeSingle(),
    ]);
    const path = pathOptionIds(p.ended.path);
    if (!path.length) return null;
    const person = await personOf(p.admin, p.userId, states, tasks, concerns);
    const prev = concerns.find((r) => r.concern_id === p.ended.sceneKey);
    const cs = prev ? CS.concernStateFromRow(prev) : CS.newConcernState(p.userId, p.ended.sceneKey);
    const worry = (sess?.worry_pick ?? null) as { intent_id?: string | null; secondary?: string | null } | null;
    const rejected = Object.values(states).filter((s) => s?.status === "rejected").map((s) => s.root_id);
    const tc = CS.taskCandidates(path, cardData.options, {
      intentId: worry?.intent_id ?? undefined, secondaryId: worry?.secondary ?? undefined, hasChild: person.hasChild, rejected, ruledOut: cs.ruled_out,
    });
    PS.addLadderCandidates(tc, person);
    CS.applyCardPath(cs, path, tc.roots, { confirmed: p.ended.reason === "confirmed", rootStates: states as never, person: person as never });
    PS.fillCoping(cs, person);
    const words = PS.wordsFrom(p.recentUserTexts);
    const picked = CS.pickTasks(cs, tc.candidates, {
      fallback: tc.fallback, route: p.ended.route ?? undefined, relRoots: tc.relRoots, hasChild: person.hasChild, personal: PS.scorer(cs, person), formatOf: PS.sizeOf,
    });
    const planned = (PS.withPlans(picked, cs, tc.roots, words) as PlannedTask[])
      .filter((t) => engine.titles[t.practice_id])
      .map((t) => ({ ...t, plan: { ...(t.plan ?? {}), title: engine.titles[t.practice_id] } }));
    await saveConcern(p.admin, cs);
    if (!planned.length) return null;
    return {
      finalize: async (usedFallback) => {
        if (usedFallback) return undefined;
        // 건넨 기록(taskOffered). 고르기 전까지 건넨 과제의 계획은 plan.offered에 둔다 — 고르면 고른 것의 계획(taskPlanFields)으로 바뀐다.
        const offeredRow = CS.taskOffered(p.userId, p.sessionId, cs, planned) as Record<string, unknown>;
        const { data: ins, error } = await p.admin.from("sw_user_tasks").insert({ ...offeredRow, plan: { offered: planned } }).select("id").single();
        if (error || !ins) { console.warn("과제 건넴 저장 실패:", error?.code); return undefined; }
        const card = taskOfferPayload(Number(ins.id), planned);
        const { error: me } = await p.admin.from("chat_messages").insert({
          session_id: p.sessionId, user_id: p.userId, role: "assistant", content: card.text, route: p.route, reflection_signal_id: `sw-task:offer:${ins.id}`,
        });
        if (me) return undefined;
        return { text: card.text, choices: [], card };
      },
    };
  } catch (e) {
    console.warn("과제 고르기 실패, 과제 없이 진행:", e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return null;
  }
}

async function ownRow(admin: Admin, userId: string, id: number): Promise<TaskRow | null> {
  const { data } = await admin.from("sw_user_tasks").select("*").eq("id", id).eq("user_id", userId).is("hidden_at", null).maybeSingle();
  return (data as TaskRow | null) ?? null;
}
const offeredOf = (row: TaskRow): PlannedTask[] => (Array.isArray((row.plan as { offered?: unknown } | null)?.offered) ? ((row.plan as { offered: PlannedTask[] }).offered) : []);

export type TaskReply = { text: string; card?: CardPayload };

// ② 건넨 과제 중 하나를 골랐을 때(또는 "지금은 괜찮아요"). 건넨 행·건넨 보기가 맞는지 서버가 다시 확인한다.
export async function chooseTask(admin: Admin, userId: string, pick: { row: number; practice: string }): Promise<TaskReply | null> {
  const row = await ownRow(admin, userId, pick.row);
  if (!row || row.practice_id) return null; // 남의 행·이미 고른 행
  if (pick.practice === "later") return { text: TASK_LATER_REPLY }; // 고르지 않음 = practice_id 빈 채로 둠(엔진 historyOf가 "고르지 않음"으로 셈)
  const t = offeredOf(row).find((x) => x.practice_id === pick.practice);
  if (!t) return null;
  await loadTaskEngine(admin); // taskPlanFields가 실천 표시(path)를 읽는다
  const chosen = CS.taskChosen(row, t.practice_id) as Record<string, unknown>;
  const fields = PS.taskPlanFields(t) as Record<string, unknown>;
  const { error } = await admin.from("sw_user_tasks").update({ practice_id: chosen.practice_id, ...fields, plan: { ...(t.plan ?? {}), offered: offeredOf(row).map((x) => x.practice_id) } }).eq("id", row.id).eq("user_id", userId);
  if (error) throw new Error(`sw_user_tasks 고름 저장 ${error.code}`);
  return { text: taskChosenReply(t) };
}

// ③ 다음 대화 첫머리: 고르고 결과가 없는 가장 최근 과제(30일 안). 없으면 null.
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
  if (sink.length) {
    const { error } = await admin.rpc("sw_apply_ops", { p_user: userId, p_ops: sink });
    if (error) throw new Error(`sw_apply_ops ${error.code}`);
  }
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
