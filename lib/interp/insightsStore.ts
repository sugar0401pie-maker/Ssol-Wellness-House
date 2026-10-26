import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as RS from "./vendor/rootState.mjs";
import { loadData, readStates } from "./hypothesis";
import { buildInsights, type Insight, type InsightAction } from "./insights";

// 마이페이지 "쏘웰라가 파악한 내용"의 읽기·정정·삭제(2026-10-18, 로드맵 10번). 모두 본인 장부(sw_*)에만 적용되고, 장부가 단일 진실 원천이다.
type Admin = ReturnType<typeof createAdminClient>;
type State = ReturnType<typeof RS.newRootState>;

export async function loadInsights(admin: Admin, userId: string): Promise<Insight[]> {
  const [{ texts }, states] = await Promise.all([loadData(admin), readStates(admin, userId)]);
  return buildInsights(states, texts);
}

// confirm: 사용자가 "맞아요"로 정함(확인) · reject: "아니에요"(이 짐작은 더 쓰지 않음) · remove: 이 뿌리에 쌓인 근거를 모두 지움(정정 처리 = superseded).
export async function applyInsightAction(admin: Admin, userId: string, rootId: string, action: InsightAction): Promise<boolean> {
  const { texts } = await loadData(admin);
  if (!texts[rootId]) return false;
  const { data, error } = await admin.rpc("sw_read_ledger", { p_user: userId });
  if (error) throw new Error(`sw_read_ledger ${error.code}`);
  const states = RS.hydrate(userId, data ?? [], []) as Record<string, State>;
  const st = states[rootId] ?? RS.newRootState(userId, rootId);
  const now = new Date().toISOString();
  const sink: unknown[] = [];
  if (action === "remove") {
    for (const e of (st.ledger as { event_id: string; validity: string }[]).filter((x) => x.validity === "active")) RS.supersedeEvent(st, e.event_id, sink);
  } else {
    RS.recordAnswer(st, action === "confirm" ? "accepted" : "rejected", now, null, sink, { event_id: `my:${rootId}:${Date.now()}` });
  }
  if (sink.length) {
    const { error: oe } = await admin.rpc("sw_apply_ops", { p_user: userId, p_ops: sink });
    if (oe) throw new Error(`sw_apply_ops ${oe.code}`);
  }
  return true;
}

// 쏘웰라가 파악한 내용 전부 지우기(해석 기록·장부). 대화 내용 자체나 심리상담사 상담 기록은 건드리지 않는다.
export async function clearInsights(admin: Admin, userId: string): Promise<void> {
  const { error } = await admin.rpc("sw_purge_user", { p_user: userId, p_include_human: false });
  if (error) throw new Error(`sw_purge_user ${error.code}`);
}
