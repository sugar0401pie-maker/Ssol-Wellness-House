import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as RS from "./vendor/rootState.mjs";
import { evaluateDeepening, DEEPENING_INFO_BLOCK } from "@/lib/safety/deepening";

// 깊어짐(③)의 서버 쪽 연결(2026-10-27, docs/깊어짐_설계_v0.1.md). 신호 판별은 lib/safety/deepening.ts(AI 없음) — 여기서는 (1) 답변 뒤 해석 단계에서 "그 뿌리를 다룬 턴"을 엔진(onTheoryTurn)으로 세어
// sw_user_root_state(뿌리별 누적 턴·나아짐 이후 턴·깊어짐 신호·주의 표시)에 저장하고, (2) 다음 채팅 턴에서 넘김(주의 표시)이 난 뿌리가 있으면 도움받을 곳 안내 지침을 한 번 준다.
// "어느 뿌리의 턴인지"는 기존 해석(발화 분류)이 고른 1순위 뿌리를 쓴다(Q1 권장안 — 판단은 규칙, 귀속만 해석). 위기 이력(crisis)에는 남기지 않는다(CSO ③-8). 끄기: SW_DEEPENING_ENABLED=0.
type Admin = ReturnType<typeof createAdminClient>;
export const deepeningOn = () => process.env.SW_DEEPENING_ENABLED !== "0";

const COLS = "root_id, turns_total, turns_since_improve, last_improve_at, last_improve_chat_id, escalate_seen, escalated_at, escalated_reason, caution_hold, human_phrase_last, updated_at";
const mark = (escalatedAt: string | null) => `deepen:${escalatedAt ?? ""}`; // human_phrase_last에 "이 넘김의 안내를 이미 했다"를 남기는 표시(휴먼 세션 안내 칸은 앱이 쓰지 않는다)

export async function recordDeepeningTurn(admin: Admin, p: { userId: string; sessionId: string; messageId: string; rootId: string; text: string }): Promise<void> {
  if (!deepeningOn()) return;
  const { data: me } = await admin.from("chat_messages").select("created_at").eq("message_id", p.messageId).maybeSingle();
  if (!me?.created_at) return;
  const { data: prev } = await admin.from("chat_messages").select("role, content").eq("session_id", p.sessionId).lt("created_at", me.created_at).order("created_at", { ascending: false }).limit(4);
  const previousUser = (prev ?? []).find((m) => m.role === "user")?.content ?? null;
  const lastAssistant = (prev ?? []).find((m) => m.role === "assistant")?.content ?? null;
  const ev = evaluateDeepening(p.text, previousUser, lastAssistant);

  const [{ data: ledger, error: le }, { data: rows, error: re }] = await Promise.all([
    admin.rpc("sw_read_ledger", { p_user: p.userId }),
    admin.from("sw_user_root_state").select(COLS).eq("user_id", p.userId).eq("root_id", p.rootId),
  ]);
  if (le || re) throw new Error(`깊어짐 상태 읽기 실패 ${le?.code ?? re?.code}`);
  if (!rows?.length) return; // 이 뿌리에 근거가 아직 없으면 센 턴이 없다(근거가 쌓이면 행이 생긴다)
  const states = RS.hydrate(p.userId, ledger ?? [], rows) as Record<string, ReturnType<typeof RS.newRootState>>;
  const st = states[p.rootId];
  if (!st) return;
  const before = { hold: !!st.caution_hold, at: st.escalated_at as string | null };
  const now = new Date().toISOString();
  const res = RS.onTheoryTurn(st, { chatId: p.sessionId, at: now, escalate: ev.confirmed, improve: ev.improve, safety2: [] }) as { decision: string };
  const escalated = res.decision === "route_safety_3";
  const { error } = await admin.from("sw_user_root_state").update({
    turns_total: st.turns_total, turns_since_improve: st.turns_since_improve, last_improve_at: st.last_improve_at ?? null, last_improve_chat_id: ev.improve ? p.sessionId : st.last_improve_chat_id ?? null,
    last_improve_text: null, // 사용자 말 조각은 저장하지 않는다
    escalate_seen: st.escalate_seen, escalated_at: st.escalated_at ?? null, escalated_reason: st.escalated_reason ?? null, caution_hold: !!st.caution_hold, updated_at: now,
    // 나아짐 신호로 주의 표시가 풀리면 "안내를 이미 했다"는 표시도 비운다(다시 쌓여 넘어가면 다시 한 번 안내)
    ...(before.hold && !st.caution_hold ? { human_phrase_last: null } : {}),
  }).eq("user_id", p.userId).eq("root_id", p.rootId);
  if (error) throw new Error(`깊어짐 상태 저장 실패 ${error.code}`);
  if (escalated) await admin.from("chat_sessions").update({ safety_flag: "elevated" }).eq("session_id", p.sessionId).eq("safety_flag", "none"); // 운영 검토 대상(위기 이력에는 남기지 않음)
}

// 다음 채팅 턴에서 쓸 도움받을 곳 안내 지침. 주의 표시가 켜져 있고 이 넘김의 안내를 아직 안 했으면 블록을 돌려주고, markGiven()으로 "했다"를 남긴다.
export async function deepeningInfoGuidance(admin: Admin, userId: string): Promise<{ block: string; markGiven: () => Promise<void> } | null> {
  if (!deepeningOn()) return null;
  const { data, error } = await admin.from("sw_user_root_state").select("root_id, escalated_at, human_phrase_last").eq("user_id", userId).eq("caution_hold", true);
  if (error || !data?.length) return null;
  const todo = data.filter((r) => r.human_phrase_last !== mark(r.escalated_at));
  if (!todo.length) return null;
  return {
    block: `- ${DEEPENING_INFO_BLOCK}`,
    markGiven: async () => { for (const r of todo) await admin.from("sw_user_root_state").update({ human_phrase_last: mark(r.escalated_at) }).eq("user_id", userId).eq("root_id", r.root_id); },
  };
}

// 주의 표시가 켜진 뿌리(불편 머무르기 실천 제외용).
export async function cautionHoldRoots(admin: Admin, userId: string): Promise<Set<string>> {
  if (!deepeningOn()) return new Set();
  const { data } = await admin.from("sw_user_root_state").select("root_id").eq("user_id", userId).eq("caution_hold", true);
  return new Set((data ?? []).map((r) => r.root_id));
}
