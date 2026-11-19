// 과제(작은 연습) 흐름의 순수 함수 — CSO 엔진 ssol_case v0.16 · ssol_personal v0.8(2026-11-18 3부-3).
// 카드가 끝나면 엔진이 고른 연습 두 가지를 건네고(task 카드), 고르면 저장했다가 다음 대화 첫머리에 "해 보니 어땠어요?"(task_result 카드) →
// 해 봤으면 확인 질문(task_check 카드) → 답을 근거 장부에 넣는다. 화면 문장은 고정(AI 없음). 진단·처방이 아니라 고를 수 있는 제안이다.
// 클라이언트도 타입을 쓰므로 "server-only"를 넣지 않는다.
import type { CardPayload, TaskResult } from "../cards/flow.ts";

// 연습을 건네는 카드 끝(엔진 _end reason). "별로 아니에요"(confirm_rejected) · "그만할래요"(user_stop) · 모름으로 멈춤(dont_know)에는 건네지 않는다 —
// 이유를 함께 찾지 못했거나 본인이 멈춘 자리에서 연습부터 내밀지 않는다(권하지 않고 고르게 — CLAUDE.md §2).
// 2026-11-19(3부-4): 카드를 끝까지 답해 자연스럽게 끝난 길도 더함 — 상태·여건·선호로 끝난 길(no_root · no_root_confirm_skipped)은 엔진이 "지나가는 일인지 되풀이되는 일인지"를 먼저 판단하거나 묻고 그에 맞는 연습을 고른다(엔진 안내 v3.13~v3.17),
// 이미 확인된 뿌리(already_confirmed) · 카드 수 끝(max_cards)도 같다.
export const TASK_OFFER_ENDINGS: ReadonlySet<string> = new Set(["confirmed", "confirm_partial", "confirm_weak", "deficit_hypothesis", "no_root", "no_root_confirm_skipped", "already_confirmed", "max_cards"]);

// 카드 세션 길(sess.path: {card, pick}) → 고른 보기 id 목록(엔진 taskCandidates의 pathOptionIds). 고정 버튼·건너뛰기는 뺀다. 두 개 고른 것("A+B")은 둘 다.
export function pathOptionIds(path: unknown): string[] {
  if (!Array.isArray(path)) return [];
  const out: string[] = [];
  for (const step of path) {
    const pick = (step as { pick?: unknown })?.pick;
    if (typeof pick !== "string" || /^(FX-|JUMP|CORRECT)/.test(pick)) continue;
    for (const id of pick.split("+")) if (id) out.push(id);
  }
  return out;
}

export type PlannedTask = {
  practice_id: string;
  stage?: string | null;
  root?: string | null;
  root_direct?: boolean;
  plan?: { line?: string; minutes?: string | null; first_step?: string | null; cue?: string | null; when_options?: string[]; format?: string | null; title?: string | null; check?: unknown } | null;
};

export const TASK_LATER = { id: "FX-LATER" as const, label: "지금은 괜찮아요" };
export const TASK_OFFER_TEXT = "오늘 이야기에 맞춰 해 볼 만한 작은 연습 두 가지를 골라 봤어요. 끌리는 게 있으면 하나 골라 주세요. 안 골라도 괜찮아요.";

const titleOf = (t: PlannedTask) => (t.plan?.title || t.practice_id).trim();

export function taskOfferPayload(row: number, tasks: PlannedTask[]): CardPayload {
  return {
    kind: "task", cardId: "CC-TASK", row, text: TASK_OFFER_TEXT,
    options: tasks.map((t) => ({ id: t.practice_id, label: t.plan?.minutes ? `${titleOf(t)} (${t.plan.minutes})` : titleOf(t) })),
    fixed: [TASK_LATER],
  };
}

// 고른 뒤 답(고정 문장). 첫 행동이 있으면 함께 — 다음 대화에서 어땠는지 가볍게 묻겠다고 알려 둔다.
export function taskChosenReply(t: PlannedTask): string {
  const lines = [`좋아요, ‘${titleOf(t)}’ 해 보기로 해요.`];
  if (t.plan?.first_step?.trim()) lines.push(`시작은 이렇게 해 보면 돼요. ${t.plan.first_step.trim()}`);
  lines.push("부담 갖지 말고 할 수 있는 만큼만 해 봐요. 다음에 오시면 해 보니 어땠는지 가볍게 물어볼게요.");
  return lines.join("\n\n");
}
export const TASK_LATER_REPLY = "좋아요. 지금은 이야기를 이어가요. 하고 싶은 이야기가 있으면 편하게 들려주세요.";

// 다음 대화 첫머리(엔진 openingFor 문장 + 어떤 연습이었는지 한 줄).
export const RESULT_OPTIONS: { id: TaskResult; label: string }[] = [
  { id: "다 함", label: "다 했어요" }, { id: "조금", label: "조금 했어요" }, { id: "못 함", label: "못 했어요" },
];
export function taskOpeningPayload(row: number, engineText: string, title: string | null): CardPayload {
  const text = title ? `${engineText}\n\n지난번에 고른 연습: ‘${title}’` : engineText;
  return { kind: "task_result", cardId: "CC-TASK-RESULT", row, text, options: RESULT_OPTIONS.map((o) => ({ id: o.id, label: o.label })), fixed: [] };
}

// 결과 답에 먼저 건네는 말(엔진 taskResult ack: did · effort · no_blame) — 노력을 먼저 인정하고, 못 했어도 탓하지 않는다.
export const RESULT_ACK: Record<"did" | "effort" | "no_blame", string> = {
  did: "해 봤군요! 시간을 내서 해 본 것만으로도 충분히 의미 있어요.",
  effort: "조금이라도 해 본 게 중요해요. 시작한 것 자체가 한 걸음이에요.",
  no_blame: "괜찮아요. 못 하는 날도 있어요. 그만큼 요즘 여유가 없었던 걸 수도 있어요.",
};
export const AFTER_TASK_PROMPT = "오늘은 어떤 이야기를 나눠 볼까요?";

export function taskCheckPayload(row: number, ack: string, question: string, options: readonly string[]): CardPayload {
  return { kind: "task_check", cardId: "CC-TASK-CHECK", row, text: `${ack}\n\n${question}`, options: options.map((o) => ({ id: o, label: o })), fixed: [] };
}

// 확인 답 뒤 마무리(고정). 더 버거웠으면 다음엔 더 가볍게 고르겠다고(엔진이 그 실천을 잠시 쉼).
export function taskCheckReply(answer: string): string {
  if (answer === "더 버거웠어요") return `버거웠다고 말해 줘서 고마워요. 다음엔 더 가벼운 걸로 골라 볼게요.\n\n${AFTER_TASK_PROMPT}`;
  return `알려 줘서 고마워요.\n\n${AFTER_TASK_PROMPT}`;
}

// ───── 2026-11-19(3부-4): 연습을 건네기 전 질문 · 지금 같이 해 보기 ─────
// 질문 문장과 보기는 엔진·DB 원문(겨루는 가설 sw_ob_root_discriminators · 뿌리 예측 sw_ob_root_predictions.probe_question · 여건 sw_ob_condition_questions · 대처 방식 sw_ob_coping_questions).
// 보기 id는 번호("0","1",…) — 서버가 저장해 둔 질문에서 다시 찾는다(요청 값을 믿지 않음).
export function taskAskPayload(row: number, ask: string, options: { text: string }[]): CardPayload {
  return { kind: "task_ask", cardId: "CC-TASK-ASK", row, text: ask, options: options.map((o, i) => ({ id: String(i), label: o.text })), fixed: [] };
}
export const MINI_OPTIONS = [{ id: "now", label: "지금 해 볼게요" }, { id: "later", label: "나중에 할게요" }] as const;
export function taskMiniPayload(row: number, chosenReply: string, invite: string, miniTitle: string, sameAsChosen: boolean): CardPayload {
  const lead = sameAsChosen ? invite : `${invite} ‘${miniTitle}’를 짧게 맛보는 거예요.`;
  return { kind: "task_mini", cardId: "CC-TASK-MINI", row, text: `${chosenReply}\n\n${lead}`, options: MINI_OPTIONS.map((o) => ({ ...o })), fixed: [] };
}
export function miniNowText(title: string, minutes: number | null, firstStep: string | null): string {
  const lines = [`좋아요. ‘${title}’${minutes ? `, ${minutes}분만` : ""} 같이 해 봐요.`];
  if (firstStep?.trim()) lines.push(firstStep.trim());
  lines.push("해 보고 나서 아래에서 골라 주세요.");
  return lines.join("\n\n");
}
export const MINI_LATER_REPLY = "좋아요. 편할 때 해 봐요. 하고 싶은 이야기가 있으면 이어서 들려주세요.";

// 2026-11-19 대표님 결정: "지금 같이 해 보기" 실천(sw_ob_practice_flags in_session, 187개)은 초안이 아니다 — 검수 대기(draft)여도 내보낸다.
// DB(sw_ob_practice_ref.review_status)는 CSO 원본이라 고치지 않고 여기서 덮는다(다음 CSO 데이터 적재 뒤에도 유지). 다른 초안 실천은 그대로 안 나간다.
export function releaseInSession(d: { review: Record<string, string | null>; in_session: string[] }): number {
  let n = 0;
  for (const id of d.in_session ?? []) if (d.review[id] !== "approved") { d.review[id] = "approved"; n++; }
  return n;
}
