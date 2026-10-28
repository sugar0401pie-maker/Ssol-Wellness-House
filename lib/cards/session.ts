import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as RS from "@/lib/interp/vendor/rootState.mjs";
import * as C from "./vendor/choiceCards.mjs";
import * as K from "@/lib/interp/vendor/claimClassifier.mjs";
import { recordCardMotive } from "@/lib/interp/growth";
import { buildCardData, type CardData } from "./data";
import { CARD_MARK, cardPayload, confirmPayload, offerExpired, toEnginePick, type CardPayload, type CardPick, type PresentLike } from "./flow";

// 선택지 카드 서버 쪽(2026-10-20, 로드맵 3·4번): 데이터 읽기 · 세션 저장(sw_choice_sessions) · 장부 반영 · 탭 처리.
// 흐름: ① 해석(뒤에서 도는 작업)이 장면을 감지하면 세션 행을 만든다(아직 아무 카드도 보여 주지 않은 상태)
//      ② 이어지는 다음 말의 답변 뒤에 첫 카드를 붙이고(offerCard) ③ 사용자가 보기를 누를 때마다 AI 없이 다음 카드/확인 카드를 돌려주고(handlePick)
//      ④ 끝(멈춤)이면 평소 대화로 돌아간다. 점수·확인은 모두 장부 사건으로 기록한다(엔진이 만든 sess.events → sw_apply_ops).
type Admin = ReturnType<typeof createAdminClient>;
type Sess = ReturnType<typeof C.newChoiceSession>;
type Row = {
  id: number; chat_id: string; started_card_id: string; card_id: string; last_option_id: string | null; cards_shown: number; dk_count: number;
  path: unknown; evidence: unknown; shown: unknown; pending_branch: string | null; ended: string | null; no_root_label: string | null; generalized: boolean | null; at: string;
};

C.CFG.enabled = true; // 켜짐 여부는 서버가 cardsEnabled()로 정한다. 엔진 자체 스위치는 항상 켜 두고, 보여 준 보기만 받는 검증(requireShown)은 그대로 둔다.

// ───── 데이터(10분 캐시) ─────
let cache: { at: number; data: CardData } | null = null;
async function rows<T>(admin: Admin, table: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table} 읽기 실패: ${error.code}`);
    out.push(...((data ?? []) as T[]));
    if ((data?.length ?? 0) < 1000) return out;
  }
}
export async function loadCardData(admin: Admin): Promise<CardData> {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache.data;
  const [scenes, cards, options, fixed, confirm, practices] = await Promise.all(
    ["sw_ob_choice_scenes", "sw_ob_choice_cards", "sw_ob_choice_options", "sw_ob_choice_cards_fixed", "sw_ob_choice_confirm", "sw_ob_choice_practice_candidates"].map((t) => rows(admin, t)),
  );
  const data = buildCardData({ scenes, cards, options, fixed, confirm, practices } as Parameters<typeof buildCardData>[0]);
  C.setData(data);
  cache = { at: Date.now(), data };
  return data;
}

// ───── 세션 ─────
const asSess = (r: Row): Sess => C.sessionFromRow({ ...r, last_option_id: r.last_option_id, dk_count: r.dk_count, cards_shown: r.cards_shown });
async function activeRow(admin: Admin, userId: string, chatId: string): Promise<Row | null> {
  const { data, error } = await admin.from("sw_choice_sessions").select("*").eq("user_id", userId).eq("chat_id", chatId).is("ended", null).order("id", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`sw_choice_sessions 조회 ${error.code}`);
  return (data as Row | null) ?? null;
}
async function save(admin: Admin, userId: string, id: number, sess: Sess): Promise<void> {
  const r = C.sessionToRow(sess, userId) as Record<string, unknown>;
  const { error } = await admin.from("sw_choice_sessions").update({ card_id: r.card_id, last_option_id: r.last_option_id, cards_shown: r.cards_shown, dk_count: r.dk_count, path: r.path, evidence: r.evidence, shown: r.shown, pending_branch: r.pending_branch, ended: r.ended, no_root_label: r.no_root_label, generalized: r.generalized }).eq("id", id).eq("user_id", userId);
  if (error) throw new Error(`sw_choice_sessions 저장 ${error.code}`);
}
async function endRow(admin: Admin, userId: string, id: number, reason: string): Promise<void> {
  await admin.from("sw_choice_sessions").update({ ended: reason }).eq("id", id).eq("user_id", userId);
}
async function flushEvents(admin: Admin, userId: string, sess: Sess): Promise<void> {
  const ops = sess.events as unknown[];
  if (ops?.length) {
    const { error } = await admin.rpc("sw_apply_ops", { p_user: userId, p_ops: ops });
    if (error) throw new Error(`sw_apply_ops ${error.code}`);
  }
  sess.events = [];
}
async function loadStates(admin: Admin, userId: string) {
  const { data, error } = await admin.rpc("sw_read_ledger", { p_user: userId });
  if (error) throw new Error(`sw_read_ledger ${error.code}`);
  return RS.hydrate(userId, data ?? [], []) as Record<string, ReturnType<typeof RS.newRootState>>;
}

// 🔸 보기(돈·가족·건강 등)는 "본인이 먼저 그 주제를 말했을 때만" 보여 준다(CSO 10-27). 이 대화의 최근 사용자 말에서 분류기와 같은 규칙(saidTopics)으로 주제를 읽는다.
// 말 원문은 읽는 데만 쓰고 저장하지 않는다. 읽기에 실패하면 빈 목록 = 🔸 보기가 모두 숨는 더 조심스러운 쪽이다.
export async function mentionedTopics(admin: Admin, userId: string, chatId: string): Promise<string[]> {
  const { data, error } = await admin.from("chat_messages").select("content").eq("user_id", userId).eq("session_id", chatId).eq("role", "user").order("created_at", { ascending: false }).limit(10);
  if (error) return [];
  const topics = new Set<string>();
  for (const m of data ?? []) for (const k of (K.saidTopics as (t: string) => string[])(String(m.content ?? ""))) topics.add(k);
  return [...topics];
}

// ① 장면 감지(해석 작업에서 호출): 이 대화에 아직 카드 세션이 없으면 "열 준비" 행을 만든다. 보여 주는 것은 다음 말에서.
export async function noteScene(admin: Admin, userId: string, chatId: string, sceneKey: string): Promise<boolean> {
  const data = await loadCardData(admin);
  const scene = data.scenes.find((s) => s.key === sceneKey);
  if (!scene) return false;
  const { count, error } = await admin.from("sw_choice_sessions").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("chat_id", chatId);
  if (error || (count ?? 0) > 0) return false; // 같은 대화에서 카드 묶음은 한 번만(CR-01)
  const row = C.sessionToRow(C.newChoiceSession(chatId, scene.first_card), userId) as Record<string, unknown>;
  const { error: ie } = await admin.from("sw_choice_sessions").insert({ ...row, card_id: scene.first_card });
  return !ie;
}

export type CardOfferPlan = { chatId: string; rowId: number };

// 이번 말에 첫 카드를 붙일지: 열 준비된 세션이 있고(아직 아무것도 안 보임), 너무 오래되지 않았으면 계획을 돌려준다. 그 외엔 null.
export async function findOffer(admin: Admin, userId: string, chatId: string): Promise<{ rowId: number; sess: Sess; at: string } | null> {
  const row = await activeRow(admin, userId, chatId);
  if (!row) return null;
  const sess = asSess(row);
  if (Object.keys(sess.shown ?? {}).length > 0) return null; // 이미 보여 줌 → 사용자의 응답을 기다리는 중(offer 대상 아님)
  if (offerExpired(row.at)) { await endRow(admin, userId, row.id, "expired"); return null; }
  return { rowId: row.id, sess, at: row.at };
}
// 이 대화에 보여 줬는데 아직 답 못 받은 카드가 있는지(사용자가 보기를 누르지 않고 글을 쓴 경우 접는다).
export async function abandonPending(admin: Admin, userId: string, chatId: string): Promise<void> {
  const row = await activeRow(admin, userId, chatId);
  if (!row) return;
  if (Object.keys((row.shown as object) ?? {}).length > 0) await endRow(admin, userId, row.id, "free_text");
}
export async function endOffer(admin: Admin, userId: string, chatId: string, reason: string): Promise<void> {
  const row = await activeRow(admin, userId, chatId);
  if (row) await endRow(admin, userId, row.id, reason);
}

// ② 첫 카드 보여 주기(답변을 저장한 뒤 호출): 세션에 "보여 준 보기"를 기록하고 화면에 보낼 모양을 돌려준다.
export async function presentFirstCard(admin: Admin, userId: string, chatId: string): Promise<CardPayload | null> {
  const offer = await findOffer(admin, userId, chatId);
  if (!offer) return null;
  const data = await loadCardData(admin);
  const states = await loadStates(admin, userId);
  const mentioned = await mentionedTopics(admin, userId, chatId);
  const r = C.presentCard(offer.sess, offer.sess.started_card_id, states, { mentioned, hypCues: [] }, data);
  if (r.type !== "card") return null;
  await save(admin, userId, offer.rowId, offer.sess);
  return cardPayload(r as unknown as PresentLike);
}

export const cardMessageMark = (p: CardPayload) => `${CARD_MARK}:${p.cardId}`;

export type PickResult = { kind: "reply"; payload: CardPayload } | { kind: "continue" };

// ③ 보기 누름 처리. 카드·확인 카드면 AI 없이 바로 답을 돌려주고(reply), 멈춤이거나 맞지 않는 요청이면 평소 대화로 넘긴다(continue).
export async function handlePick(admin: Admin, p: { userId: string; chatId: string; pick: CardPick; text: string }): Promise<PickResult> {
  const row = await activeRow(admin, p.userId, p.chatId);
  if (!row) return { kind: "continue" };
  const sess = asSess(row);
  const data = await loadCardData(admin);
  const states = await loadStates(admin, p.userId);
  const shown = (sess.shown ?? {}) as Record<string, string[]>;
  const nowIso = new Date().toISOString();
  const mentioned = await mentionedTopics(admin, p.userId, p.chatId);
  let r: Record<string, unknown>;

  if (p.pick.confirm) {
    if (!(shown.CONFIRM ?? []).includes(p.pick.confirm)) { await endRow(admin, p.userId, row.id, "invalid_confirm"); return { kind: "continue" }; }
    r = C.confirmChoice(sess, states, p.pick.confirm, nowIso, data);
  } else {
    if (!p.pick.cardId || p.pick.cardId !== sess.card_id) { await endRow(admin, p.userId, row.id, "stale_pick"); return { kind: "continue" }; }
    r = C.recordChoice(sess, states, p.userId, toEnginePick(p.pick, p.text), { mentioned, hypCues: [] }, data);
  }

  let payload: CardPayload | null = null;
  if (r.type === "card") {
    // 모름 한 번(retry)이면 같은 카드에서 이미 보여 준 보기를 빼고 다시 보여 준다.
    const denied = r.retry ? (shown[String(r.card_id)] ?? []).filter((id) => id.startsWith("GO-") || id.startsWith("CO-")) : [];
    const pr = C.presentCard(sess, String(r.card_id), states, { mentioned, hypCues: [], deniedOptions: denied }, data);
    if (pr.type === "card") payload = cardPayload(pr as unknown as PresentLike);
  } else if (r.type === "confirm") {
    // 확인 카드 보기는 엔진이 돌려준 options를 그대로 쓴다(CF-1 "맞아요, {장면} 특히 그래요"에 장면 자리 말이 들어 있음 — CSO v1.5 확인 요청 ②).
    const confirmOpts = (Array.isArray(r.options) ? r.options : C.confirmOptions(sess, data)) as { id: string; text: string }[];
    sess.shown = { ...(sess.shown ?? {}), CONFIRM: confirmOpts.map((o) => o.id) };
    payload = confirmPayload(String(r.text), confirmOpts);
  }
  await flushEvents(admin, p.userId, sess);
  await save(admin, p.userId, row.id, sess);
  // 고른 보기의 동기 위치("해야 해서" ↔ "하고 싶어서")를 기록한다(CSO MV-01). 뿌리 점수와 별개이고, 실패해도 카드 흐름에는 영향이 없다.
  if (p.pick.optionId) {
    const opt = data.options[p.pick.optionId];
    const scene = data.scenes.find((s) => s.first_card === sess.started_card_id);
    await recordCardMotive(admin, { userId: p.userId, chatId: p.chatId, cardId: p.pick.cardId ?? "", optionId: p.pick.optionId, claimId: opt?.claim_id || null, sceneKey: scene?.key ?? null }).catch(() => undefined);
  }
  // CSO v1.5 확인 요청 ①: 이 보기는 위기·폭력 신호가 섞일 수 있어(safety_hint) 카드 흐름으로 이어 가지 않고 평소 대화로 넘긴다.
  // 점수는 이미 기록했고, 이 말은 라우터가 먼저 검사했다. 평소 대화에서는 처음엔 이유를 묻고 반복되면 스크리닝 질문을 하는 안전 단계가 그대로 작동한다.
  if (r.safety_check) { await endRow(admin, p.userId, row.id, "safety_check"); return { kind: "continue" }; }
  return payload ? { kind: "reply", payload } : { kind: "continue" };
}
