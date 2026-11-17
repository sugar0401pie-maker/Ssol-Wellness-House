// 이용 보고서의 "쏘웰라 AI 평가"를 요청하는 글과 결과 나누기(순수 함수 — 시험: reportPrompts.test.ts).
// 평가는 내부 라운드테이블(전문가 검토)용 메모다. 진단·병명 붙이기는 하지 않고, 이용자의 말을 근거로 한 관찰과 "가설"만 쓰게 한다(CLAUDE.md 안전 규칙 4장 — 내부 문서라도 같은 선).
import { clip, type SessionFact } from "./reportFacts.ts";
import { kstDateTime } from "./range.ts";

export const MAX_EVALUATED_SESSIONS = 40; // 이보다 많으면 최근 40개만 AI가 평가하고, 나머지는 원문만 싣는다.
const BATCH_CHARS = 22_000;
const BATCH_SESSIONS = 8;
const SESSION_CHARS = 12_000;

const COMMON_RULES = [
  "당신은 쏘웰라(웰니스 상담 AI 서비스)의 내부 검토 보조입니다. 아래 대화는 한 이용자와 쏘웰라의 실제 대화 기록이고, 내부 라운드테이블(전문가 검토)이 읽을 평가 메모를 씁니다.",
  "규칙: (1) 진단·병명·장애 이름을 붙이지 않습니다(“~인 것 같다”로 돌려 말하는 것도 금지). (2) 이용자가 한 말을 근거로 관찰과 가설만 씁니다. 추정은 반드시 “가설:”로 표시하고, 확인이 필요하다고 덧붙입니다. (3) 이용자의 말을 인용할 때는 짧게 큰따옴표로 옮깁니다. (4) 이용자가 말하지 않은 사실을 지어내지 않습니다. (5) 위험 신호(자해·자살·폭력·통제 등)가 보이면 맨 앞에 “주의 필요:”로 표시하고 근거 문장을 인용합니다. (6) 마크다운 기호(**, #, -, *)를 쓰지 않고 일반 문장으로 씁니다. (7) 한국어로 씁니다.",
].join("\n");

export const SESSION_SYSTEM = `${COMMON_RULES}
각 대화는 “### S숫자 …” 줄로 시작합니다. 대화마다 같은 번호로 다시 “### S숫자” 줄을 쓰고 그 아래에 다음 네 줄만 씁니다(각 1~3문장).
핵심 주제와 감정: …
관찰된 패턴(가설): …
쏘웰라 응답 점검: 경청했는지, 단정하거나 진단처럼 말하지 않았는지, 선택을 이용자에게 남겼는지, 안전 규칙(진단·약 지시 없음)을 지켰는지, 아쉬운 점.
다음에 살펴볼 점: …`;

export const OVERALL_SYSTEM = `${COMMON_RULES}
아래 자료(이용 사실 요약과 대화 발췌)를 바탕으로 이 이용자의 쏘웰라 이용 전체에 대한 종합 평가를 쓰고, 다음 네 줄 머리말을 그대로 사용해 각각 2~4문장으로 씁니다.
종합 평가: …
사용된 이론과 접근 점검: 기록된 이론·이유 가설이 이용자의 이야기와 어울렸는지.
주의 신호 요약: 없으면 “기록된 주의 신호 없음”.
라운드테이블에서 논의할 질문: 1~3개를 한 문장씩.`;

export function renderTranscript(s: SessionFact, limit = SESSION_CHARS): string {
  const lines = s.messages.map((m) => (m.role === "user" ? `이용자: ${m.content.replace(/\s+/g, " ").trim()}` : `쏘웰라: ${clip(m.content.replace(/\s+/g, " ").trim(), 400)}`));
  const out: string[] = [];
  let used = 0;
  for (const l of lines) {
    if (used + l.length > limit) { out.push("(이하 길이 제한으로 생략)"); break; }
    out.push(l);
    used += l.length;
  }
  return out.join("\n");
}

export function sessionBlock(s: SessionFact): string {
  const tag = s.level ? ` [경고 ${s.level.toUpperCase()}]` : "";
  return `### ${s.code} · ${kstDateTime(s.startedAt)} · ${s.topic}${tag}\n${renderTranscript(s)}`;
}

// 최근 MAX_EVALUATED_SESSIONS개를 묶음으로 나눈다(묶음마다 AI 호출 1번). 묶음은 시간 순서를 유지한다.
export function buildBatches(sessions: SessionFact[]): SessionFact[][] {
  const target = sessions.slice(-MAX_EVALUATED_SESSIONS);
  const batches: SessionFact[][] = [];
  let cur: SessionFact[] = [];
  let chars = 0;
  for (const s of target) {
    const len = sessionBlock(s).length;
    if (cur.length && (cur.length >= BATCH_SESSIONS || chars + len > BATCH_CHARS)) { batches.push(cur); cur = []; chars = 0; }
    cur.push(s);
    chars += len;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

// AI 결과를 "### S03" 머리별로 나눈다. 빠진 번호는 빈 값으로 둔다(보고서에 "평가를 만들지 못했어요"로 표시).
export function parseBatchOutput(text: string, codes: string[]): Map<string, string> {
  const out = new Map<string, string>();
  const parts = text.split(/^###\s*(S\d+)[^\n]*\n?/m);
  for (let i = 1; i < parts.length; i += 2) if (codes.includes(parts[i])) out.set(parts[i], parts[i + 1].trim());
  return out;
}

// 평가 머리말(“핵심 주제와 감정: …”)을 칸 목록으로 나눈다. 머리말을 못 찾으면 통째로 한 칸.
export function splitLabeled(text: string, labels: string[]): { label: string; body: string }[] {
  const found: { label: string; at: number }[] = [];
  for (const label of labels) { const at = text.indexOf(`${label}:`); if (at >= 0) found.push({ label, at }); }
  found.sort((a, b) => a.at - b.at);
  if (!found.length) return text.trim() ? [{ label: "", body: text.trim() }] : [];
  return found.map((f, i) => ({ label: f.label, body: text.slice(f.at + f.label.length + 1, found[i + 1]?.at ?? text.length).trim() }));
}
export const SESSION_LABELS = ["핵심 주제와 감정", "관찰된 패턴(가설)", "쏘웰라 응답 점검", "다음에 살펴볼 점"];
export const OVERALL_LABELS = ["종합 평가", "사용된 이론과 접근 점검", "주의 신호 요약", "라운드테이블에서 논의할 질문"];

export function overallPrompt(facts: { sessionCount: number; messageCount: number; activeDays: number; firstAt: string | null; lastAt: string | null; overallLevel: string | null; theories: { name: string; direct: number; viaRoots: number }[]; alerts: { code: string; level: string; reasons: string[] }[]; sessions: SessionFact[] }): string {
  const lines: string[] = [];
  lines.push(`이용 기간: ${kstDateTime(facts.firstAt)} ~ ${kstDateTime(facts.lastAt)} · 대화 ${facts.sessionCount}개 · 메시지 ${facts.messageCount}개 · 활동일 ${facts.activeDays}일`);
  lines.push(`기록된 경고 단계: ${facts.overallLevel ?? "없음"}`);
  if (facts.alerts.length) lines.push(`경고 대화: ${facts.alerts.map((a) => `${a.code}(${a.level}: ${a.reasons.join("; ")})`).join(" / ")}`);
  lines.push(facts.theories.length ? `기록된 이론: ${facts.theories.map((t) => `${t.name}(직접 ${t.direct}회·이유 가설 경유 ${t.viaRoots}회)`).join(", ")}` : "기록된 이론: 없음");
  lines.push("", "대화 발췌(대화마다 이용자 말 앞부분):");
  for (const s of facts.sessions.slice(-MAX_EVALUATED_SESSIONS)) {
    const firstUsers = s.messages.filter((m) => m.role === "user").slice(0, 3).map((m) => clip(m.content.replace(/\s+/g, " "), 200));
    lines.push(`[${s.code} ${kstDateTime(s.startedAt)}] ${firstUsers.join(" / ")}`);
  }
  return lines.join("\n");
}
