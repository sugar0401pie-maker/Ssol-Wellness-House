import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as WM from "@/lib/interp/vendor/worryMatch.mjs";
import { handlePick, noteScene, presentFirstCard, endOffer } from "@/lib/cards/session";
import type { CardPayload } from "@/lib/cards/flow";
import { pathOptionIds, TASK_OFFER_ENDINGS } from "@/lib/tasks/flow";
import { startTasks } from "@/lib/tasks/server";
import { ensureWorryData } from "./store";
import {
  BRANCH_NO_TASK_REPLY, BRANCH_UNKNOWN_REPLY, branchCardPayload, branchCardState, branchPickAllowed, concernKeyFor,
  type BranchCardState, type EngineBranchCard,
} from "./branch";
import type { WorryRoute } from "./guidance";

// 갈래 카드 서버 흐름(CSO 묶음 v2.32 · 엔진 worryMatch v0.10 branchCard · branchPick · 규칙 WT-07, 2026-11-23).
// ① 첫 말에서 세부 고민은 정해졌는데 까닭(갈래)이 글에 없으면, 첫 답변 뒤에 갈래 카드를 붙인다(presentBranchCard — AI 없음).
// ② 보기를 누르면(handleBranchPick) — 다른 까닭이에요: 4위부터 한 번 더 · 잘 모르겠어요: 장면 카드가 있으면 그 카드로, 없으면 평소 대화로 ·
//    갈래를 고름: 카드 보기와 문장이 같은 갈래(108개)는 그 보기의 다음 카드로 이어 가고, 나머지는 바로 과제(질문 → 연습 두 가지)로.
// 보여 준 카드 상태는 chat_sessions.worry_pick.branch_card에 둔다(보여 준 보기만 받음 · 한 번만 답함). 실패하면 null — 평소 대화가 이어서 받는다.
type Admin = ReturnType<typeof createAdminClient>;
type WorryPick = Record<string, unknown> & { intent_id?: string | null; secondary?: string | null; branch_card?: BranchCardState | null };

export type BranchReply = { text: string; card?: CardPayload; mark: string };

async function readPick(admin: Admin, sessionId: string): Promise<WorryPick | null> {
  const { data, error } = await admin.from("chat_sessions").select("worry_pick").eq("session_id", sessionId).maybeSingle();
  if (error) throw new Error(`worry_pick 읽기 ${error.code}`);
  return (data?.worry_pick ?? null) as WorryPick | null;
}
async function writePick(admin: Admin, sessionId: string, pick: WorryPick): Promise<void> {
  const { error } = await admin.from("chat_sessions").update({ worry_pick: pick }).eq("session_id", sessionId);
  if (error) throw new Error(`worry_pick 저장 ${error.code}`);
}

// ① 갈래 카드를 만들고 상태를 저장한다(record = 이번 첫 말의 worry_pick — 저장이 겹치지 않게 같이 쓴다).
export async function presentBranchCard(admin: Admin, sessionId: string, record: WorryPick, more = false): Promise<CardPayload | null> {
  const intentId = record.intent_id;
  if (!intentId) return null;
  await ensureWorryData(admin);
  const card = WM.branchCard(intentId, more) as EngineBranchCard | null;
  if (!card?.options?.length) return null;
  await writePick(admin, sessionId, { ...record, branch_card: branchCardState(card) });
  return branchCardPayload(card);
}

const cardReply = (card: CardPayload, mark: string): BranchReply => ({ text: card.text, card, mark });
const taskMark = (card: CardPayload) => `sw-task:${card.kind}:${card.row ?? ""}`;

// ② 갈래 카드 답. 맞지 않는 요청(보여 주지 않은 보기·이미 답한 카드)은 null.
export async function handleBranchPick(admin: Admin, p: { userId: string; sessionId: string; option: string; route: string }): Promise<BranchReply | null> {
  const wp = await readPick(admin, p.sessionId);
  const intentId = wp?.intent_id;
  if (!wp || !intentId || !branchPickAllowed(wp.branch_card, p.option)) return null;
  await ensureWorryData(admin);
  const bp = WM.branchPick(intentId, p.option) as { branch_id: string; known: boolean; ask_more: boolean; option_id: string | null };
  const answered = { ...wp, branch_card: { ...(wp.branch_card as BranchCardState), answered: true } };

  // 다른 까닭이에요 → 4위부터 한 번 더(두 번째 카드에는 "다른 까닭이에요"가 없다).
  if (bp.ask_more) {
    const more = await presentBranchCard(admin, p.sessionId, answered, true);
    if (more) return cardReply(more, "sw-card:CC-BRANCH");
  }
  await writePick(admin, p.sessionId, { ...answered, branch_id: bp.branch_id, branch_known: bp.known, branch_by: bp.known ? "card" : "none" });

  const route = WM.routeFor(intentId, null, { secondary: wp.secondary ?? null, branchId: bp.branch_id }) as WorryRoute | null;
  if (!route) return null;
  const sceneKey = route.mode === "cards" ? route.scene_key : null;

  // 잘 모르겠어요 → 장면 카드가 있으면 그 카드로 까닭을 함께 찾고, 없으면 평소 대화로(연습을 먼저 내밀지 않는다).
  if (!bp.known) {
    if (sceneKey && (await noteScene(admin, p.userId, p.sessionId, sceneKey))) {
      const first = await presentFirstCard(admin, p.userId, p.sessionId, { preferOptions: route.preferOptions });
      if (first) return cardReply(first, `sw-card:${first.cardId}`);
    }
    return { text: BRANCH_UNKNOWN_REPLY, mark: "sw-branch:unknown" };
  }

  // 카드 보기와 문장이 같은 갈래 → 그 장면의 첫 카드에서 그 보기를 고른 것으로 하고 다음 카드로 이어 간다.
  if (bp.option_id && sceneKey && (await noteScene(admin, p.userId, p.sessionId, sceneKey))) {
    const first = await presentFirstCard(admin, p.userId, p.sessionId, { preferOptions: [bp.option_id] });
    if (first?.options.some((o) => o.id === bp.option_id)) {
      const picked = await handlePick(admin, { userId: p.userId, chatId: p.sessionId, pick: { cardId: first.cardId, optionId: bp.option_id }, text: "" });
      if (picked.kind === "reply") return cardReply(picked.payload, `sw-card:${picked.payload.cardId}`);
      if (picked.ended && TASK_OFFER_ENDINGS.has(picked.ended.reason) && picked.ended.sceneKey) {
        const task = await startTasks({ admin, userId: p.userId, sessionId: p.sessionId, path: pathOptionIds(picked.ended.path), sceneKey: picked.ended.sceneKey, route: picked.ended.route, reason: picked.ended.reason });
        if (task) return cardReply(task, taskMark(task));
      }
    } else {
      await endOffer(admin, p.userId, p.sessionId, "branch_direct"); // 그 보기를 못 보여 주면(🔸 주제 보기 등) 카드 대신 바로 과제로
    }
  }

  // 나머지 갈래 → 바로 과제(엔진 질문 → 연습 두 가지 · 갈래 행동). 건넬 게 없으면 평소 대화로.
  const task = await startTasks({ admin, userId: p.userId, sessionId: p.sessionId, path: [], sceneKey: concernKeyFor(route), route: null, reason: "branch" });
  if (task) return cardReply(task, taskMark(task));
  return { text: BRANCH_NO_TASK_REPLY, mark: "sw-branch:no-task" };
}
