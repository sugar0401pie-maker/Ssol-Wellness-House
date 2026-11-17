// 이용 보고서의 "사실" 부분(순수 함수 — DB 기록에서 그대로 뽑는다. AI가 쓰지 않는다. 시험: reportFacts.test.ts).
// 사용한 이론은 두 갈래로 센다: ① 메시지에 직접 기록된 이론·기법(theory_id·technique_id) ② 대화에서 잡힌 "이유 가설(뿌리, sw-root 표시)"이 연결된 주 이론(sw_ob_root_theory 1순위).
// 이론 선택 기능(THEORY_OFFER_ENABLED)이 꺼져 있던 기간에는 ①이 비어 있고 ②만 나온다 — 보고서에도 그 구분을 그대로 적는다.
import { assessMessage, assessRootStates, assessSession, maxLevel, type AlertLevel } from "./alerts.ts";
import { kstDay } from "./range.ts";

export type FMessage = {
  message_id: string; session_id: string; role: "user" | "assistant"; content: string; route: string | null; framework_id: string | null;
  theory_id: string | null; technique_id: string | null; dialogue_mode: string | null; reflection_signal_id: string | null; created_at: string;
  explicit?: boolean; // 위기·폭력 경로에서 이용자 글에 명시적 표현이 있었는지(lib/admin/alerts.ts)
};
export type FSession = { session_id: string; safety_flag: string | null; topic_tag: string | null; started_at: string; deleted_at: string | null };
export type FNames = { theory: Map<string, string>; technique: Map<string, string>; rootMainTheory: Map<string, string> };

export const ROOT_MARK = /^sw-root:(ROOT-\d+)/;
export const CARD_MARK = /^sw-card:(CC-[A-Z0-9-]+)/;

export type SessionFact = { code: string; sessionId: string; startedAt: string; topic: string; level: AlertLevel | null; reasons: string[]; deleted: boolean; messages: FMessage[] };
export type AlertFact = { code: string; level: AlertLevel; reasons: string[]; startedAt: string; excerpt: string };
export type ReportFacts = {
  sessionCount: number; messageCount: number; userMessageCount: number; activeDays: number; firstAt: string | null; lastAt: string | null;
  routeCounts: [string, number][];
  theories: { id: string; name: string; direct: number; viaRoots: number }[];
  techniques: { id: string; name: string; count: number }[];
  frameworks: { id: string; count: number }[];
  roots: { id: string; count: number; mainTheory: string }[];
  cards: number;
  sessions: SessionFact[];
  alerts: AlertFact[];
  overallLevel: AlertLevel | null;
  rootReasons: string[];
};

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
const desc = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0]);
export const sessionCode = (i: number) => `S${String(i + 1).padStart(2, "0")}`;
export const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function buildReportFacts(p: { sessions: FSession[]; messages: FMessage[]; names: FNames; rootStates: { caution_hold: boolean | null; safety2_level: string | null }[] }): ReportFacts {
  const bySession = new Map<string, FMessage[]>();
  for (const m of p.messages) (bySession.get(m.session_id) ?? bySession.set(m.session_id, []).get(m.session_id)!).push(m);

  const sessions: SessionFact[] = [];
  const alerts: AlertFact[] = [];
  let overall: AlertLevel | null = null;
  [...p.sessions].sort((a, b) => a.started_at.localeCompare(b.started_at)).forEach((s, i) => {
    const msgs = (bySession.get(s.session_id) ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const a = assessSession({ safety_flag: s.safety_flag, messages: msgs });
    const first = msgs.find((m) => m.role === "user");
    const fact: SessionFact = { code: sessionCode(i), sessionId: s.session_id, startedAt: s.started_at, topic: s.topic_tag?.trim() || (first ? clip(first.content, 30) : "(주제 없음)"), level: a.level, reasons: a.reasons, deleted: !!s.deleted_at, messages: msgs };
    sessions.push(fact);
    if (a.level) {
      // 경고가 붙은 메시지(없으면 세션 첫 사용자 말)의 직전 사용자 말을 발췌로 남긴다.
      const hit = msgs.findIndex((m) => assessMessage(m) !== null);
      const userBefore = hit >= 0 ? [...msgs.slice(0, hit + 1)].reverse().find((m) => m.role === "user") : first;
      alerts.push({ code: fact.code, level: a.level, reasons: a.reasons, startedAt: s.started_at, excerpt: userBefore ? clip(userBefore.content.replace(/\s+/g, " "), 160) : "" });
      overall = maxLevel(overall, a.level);
    }
  });
  const rootAssessment = assessRootStates(p.rootStates);
  overall = maxLevel(overall, rootAssessment.level);

  const routes = new Map<string, number>();
  const directTheory = new Map<string, number>();
  const viaRoots = new Map<string, number>();
  const tech = new Map<string, number>();
  const fw = new Map<string, number>();
  const roots = new Map<string, number>();
  let cards = 0;
  const days = new Set<string>();
  for (const m of p.messages) {
    days.add(kstDay(m.created_at));
    if (m.role === "assistant" && m.route) bump(routes, m.route);
    if (m.theory_id) bump(directTheory, m.theory_id);
    if (m.technique_id) bump(tech, m.technique_id);
    if (m.framework_id) bump(fw, m.framework_id);
    const root = m.reflection_signal_id?.match(ROOT_MARK)?.[1];
    if (root) { bump(roots, root); const th = p.names.rootMainTheory.get(root); if (th) bump(viaRoots, th); }
    if (m.reflection_signal_id && CARD_MARK.test(m.reflection_signal_id)) cards++;
  }
  const theoryIds = new Set([...directTheory.keys(), ...viaRoots.keys()]);
  const theories = [...theoryIds].map((id) => ({ id, name: p.names.theory.get(id) ?? id, direct: directTheory.get(id) ?? 0, viaRoots: viaRoots.get(id) ?? 0 })).sort((a, b) => b.direct + b.viaRoots - (a.direct + a.viaRoots) || a.id.localeCompare(b.id));
  const sorted = [...p.messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return {
    sessionCount: sessions.length, messageCount: p.messages.length, userMessageCount: p.messages.filter((m) => m.role === "user").length, activeDays: days.size,
    firstAt: sorted[0]?.created_at ?? null, lastAt: sorted.at(-1)?.created_at ?? null,
    routeCounts: [...routes].sort(desc),
    theories,
    techniques: [...tech].sort(desc).map(([id, count]) => ({ id, name: p.names.technique.get(id) ?? id, count })),
    frameworks: [...fw].sort(desc).map(([id, count]) => ({ id, count })),
    roots: [...roots].sort(desc).map(([id, count]) => ({ id, count, mainTheory: p.names.rootMainTheory.get(id) ? (p.names.theory.get(p.names.rootMainTheory.get(id)!) ?? p.names.rootMainTheory.get(id)!) : "" })),
    cards, sessions, alerts, overallLevel: overall, rootReasons: rootAssessment.reasons,
  };
}

// 대화원문 표의 "이론·접근" 칸에 쓸 한 줄(메시지 하나의 기록).
export function describeApproach(m: Pick<FMessage, "theory_id" | "technique_id" | "framework_id" | "dialogue_mode" | "reflection_signal_id">, names: FNames): string {
  const parts: string[] = [];
  if (m.theory_id) parts.push(`이론 ${names.theory.get(m.theory_id) ?? m.theory_id}`);
  if (m.technique_id) parts.push(`기법 ${names.technique.get(m.technique_id) ?? m.technique_id}`);
  if (m.framework_id) parts.push(`틀 ${m.framework_id}`);
  if (m.dialogue_mode) parts.push(`대화방식 ${m.dialogue_mode}`);
  const root = m.reflection_signal_id?.match(ROOT_MARK)?.[1];
  if (root) { const th = names.rootMainTheory.get(root); parts.push(`이유 가설 ${root}${th ? `(주 이론 ${names.theory.get(th) ?? th})` : ""}`); }
  const card = m.reflection_signal_id?.match(CARD_MARK)?.[1];
  if (card) parts.push(`선택 카드 ${card}`);
  return parts.join(" · ");
}
