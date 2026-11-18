// 안전 신호 뒤에 무엇을 말할지(2026-11-18 CSO 결정 — 개발 요청 v1.3 §1). 순수 함수(네트워크 없음, 시험: safetyReply.test.ts).
// 판단은 lib/safety(explicit.ts·combine.ts)가 하고, 여기서는 엔진 ssol_safety_reply v0.3(vendor/safetyReply.mjs)으로 문장과 버튼만 정한다:
//  · 고정 안내문을 쓰지 않고 공감 → 듣는 질문. 대화에는 전화번호를 넣지 않는다(119 포함).
//  · 한 대화에서 "힘든 메시지"(안전 신호 + AI가 위기로 본 말)가 4번째일 때 한 번만 마이페이지 안내 한 줄 + "마이페이지로 가기" 버튼. 어떤 신호든 같다(응급 포함 — 대표님 확인 2026-11-18).
//  · 같은 말만 한다는 반응엔 사과하고 듣기 · 신호 뒤 6턴은 이어 듣기(follow) · 그다음 평소 대화.
//  · 확인 질문 없음.
// 대화별 상태(쓴 문장 id·힘든 메시지 수 등)는 chat_sessions.safety_reply_state에 JSON으로 둔다 — 원문은 남기지 않는다.
import * as SR from "../interp/vendor/safetyReply.mjs";
import { HELP_RESOURCES, SAFETY_REPLIES, SAFETY_REPLY_TIERS, type HelpResource } from "./safetyReplyData.ts";

export type ReplyState = { used: string[]; pointer: boolean; crisisTurns: number; heavyTurns: number; lastTier: string | null; lastGroup: string | null; sinceSignal: number };
export type ReplyAction = { type: "button"; label: string; target: string };
export type ReplyPlan = { mode: "safety" | "repair" | "follow" | "normal"; tier: string | null; parts: { kind: string; text: string; reply_id?: string; action?: ReplyAction }[] };

let loaded = false;
// DB에서 읽은 값이 있으면 그것을, 없으면 코드 기본값을 쓴다(한 번만).
export function ensureReplyData(db?: { tiers?: { signal_id: string; tier: string }[]; replies?: typeof SAFETY_REPLIES; resources?: HelpResource[] } | null): void {
  if (db?.tiers?.length && db.replies?.length) { SR.setReplyData({ tiers: db.tiers, replies: db.replies, resources: db.resources?.length ? db.resources : HELP_RESOURCES }); loaded = true; return; }
  if (!loaded) { SR.setReplyData({ tiers: SAFETY_REPLY_TIERS, replies: SAFETY_REPLIES, resources: HELP_RESOURCES }); loaded = true; }
}

function validState(s: unknown): s is ReplyState {
  const x = s as ReplyState | null;
  return !!x && Array.isArray(x.used) && typeof x.heavyTurns === "number" && typeof x.pointer === "boolean";
}

// 한 턴의 계획. state가 없거나 깨져 있으면 새 대화로 본다. 돌려받은 state를 그대로 저장하면 된다.
export function planTurn(state: unknown, input: { codes: string[]; heavy: boolean; text: string }): { state: ReplyState; plan: ReplyPlan } {
  ensureReplyData();
  const st: ReplyState = validState(state) ? { ...state, used: [...state.used] } : (SR.newReplyState() as ReplyState);
  const plan = SR.planReply(st, input) as ReplyPlan;
  return { state: st, plan };
}

// 버튼이 가리키는 곳 → 앱 주소.
export const ACTION_HREF: Record<string, string> = { mypage_help: "/mypage#help", help_screen: "/help" };

// 계획을 말풍선 글자와 버튼으로. 안내(pointer) 문장은 맨 뒤 단락에 두고 버튼을 단다.
export function composeReply(plan: ReplyPlan): { text: string; action: ReplyAction | null } {
  const body = plan.parts.filter((p) => p.kind !== "pointer").map((p) => p.text);
  const pointer = plan.parts.find((p) => p.kind === "pointer");
  return { text: [...body, ...(pointer ? [pointer.text] : [])].join("\n\n"), action: pointer?.action ?? null };
}

// 관리자 화면·로그용 표시(원문 없음). 예: "sw-safe:safety:direct"
export const safetyMarker = (plan: ReplyPlan) => `sw-safe:${plan.mode}:${plan.tier ?? "-"}`;

export function helpResources(): HelpResource[] {
  return [...HELP_RESOURCES].sort((a, b) => a.sort - b.sort);
}

// 시스템 안내(분류기 장애·하루 사용량 끝)에 붙이는 한 줄 — 예전엔 여기에 109·1577-0199 번호를 넣었지만, 대화에는 번호를 넣지 않는다(CSO 11-18).
export const HELP_POINTER_LINE = "혼자 감당하기 벅찬 순간에 바로 이어지는 곳은 마이페이지에 늘 있어요.";
export const HELP_POINTER_ACTION: ReplyAction = { type: "button", label: "마이페이지로 가기", target: "mypage_help" };
