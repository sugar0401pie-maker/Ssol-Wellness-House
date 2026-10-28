import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as D from "./vendor/direction.mjs";
import * as M from "./vendor/motive.mjs";
import { freshRows, motiveDomains, suggestedByBot, withMessage, type SignalRow, type StoredSignal } from "./growthPure";

// 성장 방향(알아차림·내가 고름·멈추고 조절·나를 넘어섬)과 동기 위치(해야만 해 → 하고 싶어)를 sw_user_signals에 기록하고 읽는다(CSO 제1장, DB v4.5 · 엔진 v2.3, 2026-10-28).
// 뿌리 점수는 바꾸지 않는다(DIR-01). 저장하는 것은 항목(slot)·claim id·뿌리 id·메시지 id·시각뿐이고 사용자 말 조각은 저장하지 않는다.
// 기록 삭제 요청(숨김)·계정 삭제·보관 기간 정리는 DB v4.5의 sw_hide_user_records / sw_purge_user / sw_purge_inactive가 이 표를 이미 포함한다.
// 끄기: SW_GROWTH=0. 새 표·칸이 아직 없는 DB(v4.5 SQL 전)에서는 조용히 꺼진 채로 둔다 — 어떤 실패도 채팅에는 영향이 없다.
type Admin = ReturnType<typeof createAdminClient>;

export const growthOn = (): boolean => process.env.SW_GROWTH !== "0";

let loaded: { at: number; ok: boolean } | null = null;
async function all<T>(admin: Admin, table: string, cols: string): Promise<T[] | null> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(cols).range(from, from + 999);
    if (error) return null;
    out.push(...((data ?? []) as T[]));
    if ((data?.length ?? 0) < 1000) return out;
  }
}
export async function ensureGrowthData(admin: Admin): Promise<boolean> {
  if (loaded && Date.now() - loaded.at < 10 * 60 * 1000) return loaded.ok;
  const [claims, axes, texts, sceneDomains, positions] = await Promise.all([
    all<{ claim_id: string; kind: string; direction: string | null; motive: string | null }>(admin, "sw_ob_claims", "claim_id,kind,direction,motive"),
    all<Record<string, unknown>>(admin, "sw_ob_direction_axes", "axis,slot,label,report_more,report_first"),
    all<{ root_id: string; strength: string | null }>(admin, "sw_ob_root_texts", "root_id,strength"),
    all<{ scene_key: string; domain: string }>(admin, "sw_ob_scene_domains", "scene_key,domain"),
    all<{ position: string; ord: number }>(admin, "sw_ob_motive_positions", "position,ord"),
  ]);
  const ok = !!(claims && axes && texts && sceneDomains && positions) && axes.length > 0;
  if (ok) {
    (D.setDirectionData as (x: unknown) => unknown)({ claims, axes, rootTexts: texts }); // 벤더(JS)의 기본값 [] 때문에 타입이 never[]로 추론되어 느슨하게 부른다
    (M.setMotiveData as (x: unknown) => unknown)({ claims, sceneDomains, positions });
  }
  loaded = { at: Date.now(), ok };
  return ok;
}

async function insertFresh(admin: Admin, userId: string, chatId: string, rows: SignalRow[]): Promise<number> {
  if (!rows.length) return 0;
  const slots = [...new Set(rows.map((r) => r.slot))];
  const { data: existing } = await admin.from("sw_user_signals").select("slot,value,observed_at,ref").eq("user_id", userId).eq("ref", chatId).in("slot", slots);
  const fresh = freshRows(rows, (existing ?? []) as StoredSignal[]);
  if (!fresh.length) return 0;
  const { error } = await admin.from("sw_user_signals").insert(fresh.map((r) => ({ user_id: userId, slot: r.slot, value: r.value, source: "chat", observed_at: r.observed_at, ref: chatId })));
  if (error) throw new Error(`sw_user_signals 저장 ${error.code}`);
  return fresh.length;
}

/** 자유 대화 한 번의 분류 결과(검증을 통과한 claim)에서 방향·동기 위치 신호를 만들어 기록한다. */
export async function recordGrowth(admin: Admin, p: { userId: string; sessionId: string; messageId: string; text: string; lastBot?: string | null; claimIds: string[]; sceneKey?: string | null; rootIds: string[] }): Promise<number> {
  if (!growthOn() || !p.claimIds.length || !(await ensureGrowthData(admin))) return 0;
  const at = new Date().toISOString();
  const bot = suggestedByBot(p.lastBot, p.text);
  const dir = D.directionSignals({ claims: p.claimIds.map((id) => ({ claim_id: id, confidence: 1 })) }, { userId: p.userId, chatId: p.sessionId, messageId: p.messageId, at, rootsInMessage: p.rootIds, suggestedByAi: bot }) as SignalRow[];
  const mot = M.motiveSignals(p.claimIds, { userId: p.userId, chatId: p.sessionId, at, scene: p.sceneKey ?? null, suggestedByAi: bot }) as SignalRow[];
  return insertFresh(admin, p.userId, p.sessionId, withMessage([...dir, ...mot], p.messageId));
}

/** 선택지 카드에서 고른 보기의 동기 위치(방향 claim은 카드 보기에 없음). */
export async function recordCardMotive(admin: Admin, p: { userId: string; chatId: string; cardId: string; optionId: string; claimId: string | null; sceneKey: string | null }): Promise<number> {
  if (!growthOn() || !p.claimId || !(await ensureGrowthData(admin))) return 0;
  const rows = M.motiveSignals([p.claimId], { userId: p.userId, chatId: p.chatId, at: new Date().toISOString(), scene: p.sceneKey }) as SignalRow[];
  return insertFresh(admin, p.userId, p.chatId, withMessage(rows, `card:${p.cardId}:${p.optionId}`));
}

/** 최근 두 달의 방향·동기 위치 신호(숨김·취소 제외는 엔진 함수가 다시 거른다). */
export async function loadGrowthSignals(admin: Admin, userId: string, days = 62): Promise<StoredSignal[]> {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data, error } = await admin.from("sw_user_signals").select("slot,value,observed_at,ref,retracted_at,hidden_at").eq("user_id", userId).or("slot.like.growth.%,slot.like.motive.%").gte("observed_at", since).order("observed_at", { ascending: true }).limit(2000);
  if (error) return [];
  return (data ?? []) as StoredSignal[];
}

export type GrowthReport = { lines: string[]; beyond: boolean; motive: Record<string, string>; signals: StoredSignal[] };
/** 마이페이지에 붙일 변화 한 줄(DIR-03·MV-04: 늘었을 때·처음일 때만, 줄었다는 말은 없음)과 실천 추천에 쓸 값. 기록이 없으면 빈 값. */
export async function growthReport(admin: Admin, userId: string, opts: { paused?: boolean } = {}): Promise<GrowthReport> {
  const empty: GrowthReport = { lines: [], beyond: false, motive: {}, signals: [] };
  if (!growthOn() || !(await ensureGrowthData(admin))) return empty;
  const signals = await loadGrowthSignals(admin, userId);
  if (!signals.length) return empty;
  const lines = (D.directionSummary(signals, { paused: !!opts.paused }) as { line: string | null }[]).map((x) => x.line).filter((x): x is string => !!x);
  const motive: Record<string, string> = {};
  for (const dom of motiveDomains(signals)) {
    const cur = M.currentMotive(signals, dom) as string | null;
    if (cur) motive[dom] = cur;
    const shift = M.motiveShiftLine(signals, dom) as string;
    if (shift && !lines.includes(shift)) lines.push(shift);
  }
  return { lines, beyond: D.beyondSignal(signals) as boolean, motive, signals };
}
