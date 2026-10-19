// 가설을 대화에서 말하고 답을 받는 판단 로직 — 순수 함수(2026-10-18, 개발 1·2·5번).
// 흐름: 해석이 쌓인 뿌리 중 가장 유력한 것을 "제안형" 문장(반영 + 확인 질문, 모두 DB의 검수된 원문)으로 건네고, 사용자의 답("맞아요/아니에요/일부")을 기록한다.
// 점수가 비슷한 두 후보는 가르기 질문 하나로 먼저 가른다. 말하는 횟수는 "쏘웰라의 2~4번째 답변"까지다(owner: 4턴까지).

export const HYPOTHESIS_FIRST_TURN = 2; // 첫 답변 때는 아직 해석이 없다(해석은 답변 뒤에 돈다)
export const HYPOTHESIS_MAX_TURN = 4; // owner 결정(2026-10-18): 가설을 말하는 건 한 대화에서 4턴까지
export const SPEAK_MIN_SCORE = 1.0; // 확신 높은 근거 1개(1.0점) 이상
export const DISC_GAP = 1.0; // 1·2위 점수 차가 이 안이면 가르기 질문을 먼저

export const MARKER_HYP = "sw-root";
export const MARKER_DISC = "sw-disc";

export type RootText = { root_id: string; name: string; reflect: string[]; check_q: string[]; counter: string[]; strength: string; report: string; sensitive: boolean };
export type DiscGroup = { group_id: string; roots: string[]; ask: string; options: { answer_hint: string; root: string }[] };
export type StateLite = { root_id: string; status: string; score: number; sources?: string[] };

export function inSpeakWindow(assistantTurn: number): boolean {
  return assistantTurn >= HYPOTHESIS_FIRST_TURN && assistantTurn <= HYPOTHESIS_MAX_TURN;
}

// 말할 수 있는 후보: 아직 확인·거절되지 않았고(candidate/likely), 점수가 기준 이상이며, 이 대화에서 이미 말한 뿌리가 아닌 것.
// 정렬: 점수 ↑ → 출처 수 ↑ → 뿌리 번호(항상 같은 결과가 되도록).
export function rankRoots(states: StateLite[], exclude: Set<string>, minScore = SPEAK_MIN_SCORE): StateLite[] {
  return states
    .filter((s) => (s.status === "candidate" || s.status === "likely") && s.score >= minScore && !exclude.has(s.root_id))
    .sort((a, b) => b.score - a.score || (b.sources?.length ?? 0) - (a.sources?.length ?? 0) || a.root_id.localeCompare(b.root_id));
}

export type SpeakChoice =
  | { kind: "hypothesis"; root: string; score: number }
  | { kind: "discriminator"; group: DiscGroup; roots: [string, string] };

export function chooseSpeak(states: StateLite[], exclude: Set<string>, groups: DiscGroup[], askedGroups: Set<string>): SpeakChoice | null {
  const ranked = rankRoots(states, exclude);
  if (!ranked.length) return null;
  const [top, second] = ranked;
  if (second && top.score - second.score <= DISC_GAP) {
    const g = groups.find((x) => x.roots.includes(top.root_id) && x.roots.includes(second.root_id) && !askedGroups.has(x.group_id));
    if (g) return { kind: "discriminator", group: g, roots: [top.root_id, second.root_id] };
  }
  return { kind: "hypothesis", root: top.root_id, score: top.score };
}

// 반영 문장 + 확인 질문(DB 원문). 턴 번호로 변형을 돌려 같은 문장이 반복되지 않게 한다.
export function hypothesisBlock(t: RootText, turn: number): string {
  const r = t.reflect.length ? t.reflect[turn % t.reflect.length] : "";
  const q = t.check_q.length ? t.check_q[turn % t.check_q.length] : "";
  return [r, q].filter(Boolean).join(" ").trim();
}

// ───── 마커: 말한 가설을 assistant 메시지(chat_messages.reflection_signal_id)에 표시해 다음 턴에 답을 이어 받는다 ─────
export type Marker = { kind: "hyp" | "disc"; id: string; logId: number };
export const makeMarker = (kind: Marker["kind"], id: string, logId: number) => `${kind === "hyp" ? MARKER_HYP : MARKER_DISC}:${id}:${logId}`;
export function parseMarker(v: string | null | undefined): Marker | null {
  const m = v?.match(/^(sw-root|sw-disc):([A-Za-z0-9-]+):(\d+)$/);
  return m ? { kind: m[1] === MARKER_HYP ? "hyp" : "disc", id: m[2], logId: Number(m[3]) } : null;
}

// ───── 사용자의 답 분류: 규칙 먼저, 애매하면 모델(밖에서) ─────
export type ReplyLabel = "agree" | "partial" | "disagree" | "unsure" | "topic_shift";
const norm = (t: string) => t.replace(/[\s.,!?~…"'“”‘’()]/g, "").toLowerCase();

export function classifyReplyRules(text: string): ReplyLabel | null {
  const t = norm(text);
  if (!t) return null;
  if (t.length > 30) return null; // 길면 다른 이야기를 섞었을 수 있어 모델이 본다
  if (/(아니|아뇨|아닌데|아닌것같|그건아니|그렇지않|그렇진않|그렇지는않|그런건아니|전혀)/.test(t)) return "disagree";
  if (/(조금|약간|일부|그런면도|어느정도|반쯤|가끔|때로|그럴때도|그럴때는)/.test(t)) return "partial";
  if (/(모르겠|잘모르|글쎄|생각해본적|애매)/.test(t)) return "unsure";
  if (/^(네|넵|예|응|웅|맞아|맞네|맞는|그래요|그렇죠|그렇네|그런것같|그런듯|비슷|딱|정말그|진짜그|그런편|네맞)/.test(t)) return "agree";
  return null;
}

export function parseReplyLabel(raw: string): ReplyLabel | null {
  try {
    const o = JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim());
    return ["agree", "partial", "disagree", "unsure", "topic_shift"].includes(o?.answer) ? (o.answer as ReplyLabel) : null;
  } catch { return null; }
}

export function replyPrompt(assistantText: string, userText: string): { system: string; user: string } {
  return {
    system:
      '쏘웰라가 사용자에게 "이런 마음일 수도 있을까요?" 식으로 짐작을 건넸고, 사용자가 답했다. 사용자의 답을 하나로 분류한다. ' +
      "agree=그렇다고 함, partial=일부만·조건부로 그렇다고 함, disagree=아니라고 함, unsure=잘 모르겠다·애매하다고 함, topic_shift=질문에 답하지 않고 다른 이야기를 함. " +
      'JSON 하나만 출력한다: {"answer":"agree|partial|disagree|unsure|topic_shift"}',
    user: `쏘웰라의 마지막 말: "${assistantText.slice(-300)}"\n사용자의 답: "${userText.slice(0, 300)}"`,
  };
}

export type DiscChoice = { root: string } | "both" | "none";
export function discPrompt(g: DiscGroup, userText: string): { system: string; user: string } {
  const opts = g.options.map((o) => `- ${o.root}: ${o.answer_hint}`).join("\n");
  return {
    system:
      "쏘웰라가 두 가지 중 어느 쪽에 더 가까운지 물었고, 사용자가 답했다. 사용자의 답이 어느 쪽에 가까운지 고른다. 둘 다라고 하면 both, 어느 쪽도 아니거나 모르겠다고 하면 none. " +
      `JSON 하나만 출력한다: {"choice":"${g.options.map((o) => o.root).join("|")}|both|none"}`,
    user: `질문: "${g.ask}"\n선택지:\n${opts}\n사용자의 답: "${userText.slice(0, 300)}"`,
  };
}
export function parseDiscChoice(raw: string, g: DiscGroup): DiscChoice | null {
  try {
    const o = JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim());
    if (o?.choice === "both" || o?.choice === "none") return o.choice;
    return g.options.some((x) => x.root === o?.choice) ? { root: o.choice as string } : null;
  } catch { return null; }
}

// 행 → 데이터 (DB 표 sw_ob_root_texts · sw_ob_roots · sw_ob_root_discriminators)
type TextRow = { root_id: string; reflect_1?: string | null; reflect_2?: string | null; reflect_3?: string | null; check_q_1?: string | null; check_q_2?: string | null; counter_1?: string | null; counter_2?: string | null; strength?: string | null; report?: string | null; sensitive?: boolean | string | null };
export function buildRootTexts(texts: TextRow[], roots: { root_id: string; name: string }[]): Record<string, RootText> {
  const name = new Map(roots.map((r) => [r.root_id, r.name]));
  const keep = (xs: (string | null | undefined)[]) => xs.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return Object.fromEntries(
    texts.map((t) => [t.root_id, { root_id: t.root_id, name: name.get(t.root_id) ?? t.root_id, reflect: keep([t.reflect_1, t.reflect_2, t.reflect_3]), check_q: keep([t.check_q_1, t.check_q_2]), counter: keep([t.counter_1, t.counter_2]), strength: t.strength ?? "", report: t.report ?? "", sensitive: t.sensitive === true || t.sensitive === "true" || t.sensitive === "t" }]),
  );
}
export function buildDiscGroups(rows: { group_id: string; roots: string; ask: string; options_json: unknown }[]): DiscGroup[] {
  return rows.map((r) => {
    let options: DiscGroup["options"] = [];
    try { const v = typeof r.options_json === "string" ? JSON.parse(r.options_json) : r.options_json; if (Array.isArray(v)) options = v.filter((o) => o?.root && o?.answer_hint); } catch { /* 형식이 이상하면 이 가르기 질문은 쓰지 않는다 */ }
    return { group_id: r.group_id, roots: r.roots.split(",").map((x) => x.trim()).filter(Boolean), ask: r.ask, options };
  }).filter((g) => g.options.length >= 2 && g.roots.length >= 2);
}
