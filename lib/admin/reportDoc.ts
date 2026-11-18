import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { ALERT_LABEL, assessMessage, type AlertLevel } from "./alerts.ts";
import { kstDateTime, type Range } from "./range.ts";
import { OVERALL_LABELS, SESSION_LABELS, splitLabeled } from "./reportPrompts.ts";
import type { ReportFacts } from "./reportFacts.ts";

// 이용 보고서(.docx) 만들기. 구성: 계정·기간 → 이용 요약 → 경고 → 사용한 이론·접근 → 종합 평가(AI) → 대화별 평가(AI) + 대화 원문.
// "사실"(요약·경고·이론 집계·원문)은 DB 기록에서 그대로 나오고, "평가"만 AI가 쓴다 — 문서에도 그 구분을 적는다.
const FONT = { ascii: "Malgun Gothic", eastAsia: "Malgun Gothic", hAnsi: "Malgun Gothic", cs: "Malgun Gothic" };
const SHADE: Record<AlertLevel, string> = { urgent: "F8D7DA", watch: "FFF1CC" };
const NAVY = "033667";

export type AiResult = { overall: string | null; perSession: Map<string, string>; error: string | null; evaluatedSessions: number };
export type ReportInput = {
  account: { email: string; name: string; nickname: string; provider: string; createdAt: string; code?: string; payment?: string };
  range: Range; adminEmail: string; now: Date; facts: ReportFacts; ai: AiResult;
};

function runs(text: string, o: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {}): TextRun[] {
  return text.split("\n").map((line, i) => new TextRun({ text: line, font: FONT, bold: o.bold, color: o.color, size: o.size ?? 20, italics: o.italics, ...(i > 0 ? { break: 1 } : {}) }));
}
const para = (text: string, o: { bold?: boolean; color?: string; size?: number; italics?: boolean; shade?: string; after?: number; indent?: number } = {}) =>
  new Paragraph({ children: runs(text, o), spacing: { after: o.after ?? 100 }, indent: o.indent ? { left: o.indent } : undefined, shading: o.shade ? { type: ShadingType.CLEAR, color: "auto", fill: o.shade } : undefined });
const heading = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) => new Paragraph({ heading: level, spacing: { before: 280, after: 120 }, children: [new TextRun({ text, font: FONT, bold: true, color: NAVY, size: level === HeadingLevel.HEADING_1 ? 28 : level === HeadingLevel.HEADING_2 ? 24 : 22 })] });
const labeled = (label: string, body: string) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: label ? `${label}: ` : "", font: FONT, bold: true, size: 20 }), ...runs(body)] });

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "C8CDD4" };
const borders = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
function table(head: string[] | null, rows: string[][], widths: number[]): Table {
  const mk = (text: string, w: number, bold = false, fill?: string) => new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, borders, shading: fill ? { type: ShadingType.CLEAR, color: "auto", fill } : undefined, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ children: runs(text, { bold, size: 19 }) })] });
  const all: TableRow[] = [];
  if (head) all.push(new TableRow({ tableHeader: true, children: head.map((h, i) => mk(h, widths[i], true, "E8EEF5")) }));
  for (const r of rows) all.push(new TableRow({ children: r.map((c, i) => mk(c, widths[i], i === 0 && !head)) }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: all });
}

const aiBlock = (text: string | undefined, labels: string[]): Paragraph[] =>
  text ? splitLabeled(text, labels).map((p) => labeled(p.label, p.body)) : [para("이 부분의 AI 평가를 만들지 못했어요(아래 원문과 위 사실 기록은 그대로 믿고 쓸 수 있어요).", { italics: true, color: "888888" })];

export async function buildReportDocx(i: ReportInput): Promise<Buffer> {
  const { facts, account, ai } = i;
  const body: (Paragraph | Table)[] = [];

  body.push(new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 60 }, children: [new TextRun({ text: "쏘웰라 이용 보고서", font: FONT, bold: true, size: 40, color: NAVY })] }));
  body.push(para("내부 라운드테이블 검토 전용 · 이용자의 대화 원문과 개인 정보가 들어 있어 외부 공유·재배포·모델 학습 사용을 하지 않습니다.", { bold: true, color: "B42318", size: 19, shade: "FDECEA", after: 160 }));

  body.push(heading("1. 계정과 기간", HeadingLevel.HEADING_1));
  body.push(table(null, [
    ["이름 / 닉네임", `${account.name || "-"} / ${account.nickname || "-"}`],
    ["이용자 코드", account.code || "-"],
    ["이메일 · 가입 방식", `${account.email} · ${account.provider}`],
    ["가입일(KST)", kstDateTime(account.createdAt)],
    ["결제", account.payment || "-"],
    ["보고서 기간(KST)", i.range.label],
    ["작성 일시(KST) · 작성 관리자", `${kstDateTime(i.now.toISOString())} · ${i.adminEmail}`],
  ], [28, 72]));

  body.push(heading("2. 이용 요약", HeadingLevel.HEADING_1));
  body.push(table(null, [
    ["대화(세션) · 메시지", `${facts.sessionCount}개 · ${facts.messageCount}개 (이용자 ${facts.userMessageCount}개)`],
    ["활동한 날 수", `${facts.activeDays}일`],
    ["첫·마지막 대화(KST)", `${kstDateTime(facts.firstAt)} ~ ${kstDateTime(facts.lastAt)}`],
    ["쏘웰라 응답 경로", facts.routeCounts.length ? facts.routeCounts.map(([r, n]) => `${r} ${n}`).join(" · ") : "-"],
    ["선택 카드", `${facts.cards}회`],
  ], [28, 72]));

  body.push(heading("3. 경고(alert)", HeadingLevel.HEADING_1));
  if (facts.overallLevel) body.push(para(`기록된 전체 경고 단계: ${ALERT_LABEL[facts.overallLevel]}`, { bold: true, shade: SHADE[facts.overallLevel], after: 120 }));
  else body.push(para("기록된 경고 없음(WATCH·URGENT 해당 없음).", { after: 120 }));
  for (const a of facts.alerts) {
    body.push(para(`${a.code} · ${kstDateTime(a.startedAt)} · ${ALERT_LABEL[a.level]}`, { bold: true, shade: SHADE[a.level], after: 40 }));
    body.push(para(`근거: ${a.reasons.join(" · ")}`, { size: 19, indent: 200, after: 40 }));
    if (a.excerpt) body.push(para(`이용자 발언 발췌: “${a.excerpt}”`, { size: 19, indent: 200, after: 120 }));
  }
  if (facts.rootReasons.length) body.push(para(`계정 단위 기록: ${facts.rootReasons.join(" · ")}`, { size: 19, after: 120 }));
  body.push(para("경고는 시스템이 기록한 표시를 모아 보여 주는 것이며, 위험도에 대한 진단이나 판정이 아닙니다.", { size: 18, color: "888888", italics: true }));

  body.push(heading("4. 사용한 이론과 접근", HeadingLevel.HEADING_1));
  body.push(para("① 직접 기록 = 대화 저장 때 이론·기법이 함께 기록된 횟수. ② 이유 가설 경유 = 대화에서 잡힌 이유 가설(뿌리)에 연결된 주 이론(1순위) 횟수. 이론 선택 기능이 꺼져 있던 기간에는 ①이 비어 있고 ②만 나옵니다.", { size: 18, color: "666666", after: 100 }));
  body.push(facts.theories.length
    ? table(["이론", "직접 기록", "이유 가설 경유"], facts.theories.map((t) => [t.name, `${t.direct}회`, `${t.viaRoots}회`]), [56, 20, 24])
    : para("기록된 이론 없음.", { after: 100 }));
  if (facts.techniques.length) { body.push(para("", { after: 60 })); body.push(table(["기법", "횟수"], facts.techniques.map((t) => [t.name, `${t.count}회`]), [80, 20])); }
  if (facts.roots.length) { body.push(para("", { after: 60 })); body.push(table(["이유 가설(뿌리)", "횟수", "연결된 주 이론"], facts.roots.slice(0, 15).map((r) => [r.id, `${r.count}회`, r.mainTheory || "-"]), [30, 14, 56])); }
  if (facts.frameworks.length) body.push(para(`대화 틀(프레임워크): ${facts.frameworks.map((f) => `${f.id} ${f.count}회`).join(" · ")}`, { size: 19 }));

  body.push(heading("5. 쏘웰라 AI 종합 평가", HeadingLevel.HEADING_1));
  body.push(para("아래 평가는 위 사실 기록과 대화 원문을 바탕으로 AI가 쓴 내부 검토용 메모입니다. 진단이 아니며 “가설”은 확인이 필요한 추정입니다.", { size: 18, color: "666666", italics: true, after: 100 }));
  body.push(...aiBlock(ai.overall ?? undefined, OVERALL_LABELS));
  if (ai.error) body.push(para(`AI 평가 일부를 만들지 못했어요: ${ai.error}`, { size: 18, color: "B42318" }));
  if (facts.sessionCount > ai.evaluatedSessions && ai.evaluatedSessions > 0) body.push(para(`대화가 많아 최근 ${ai.evaluatedSessions}개만 AI가 평가했어요(나머지는 원문만 실었어요).`, { size: 18, color: "666666" }));

  body.push(heading("6. 대화별 평가와 원문", HeadingLevel.HEADING_1));
  if (!facts.sessions.length) body.push(para("이 기간에 대화가 없어요."));
  for (const s of facts.sessions) {
    const tag = s.level ? `  [${ALERT_LABEL[s.level]}]` : "";
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 80 }, shading: s.level ? { type: ShadingType.CLEAR, color: "auto", fill: SHADE[s.level] } : undefined, children: [new TextRun({ text: `${s.code} · ${kstDateTime(s.startedAt)} · ${s.topic}${tag}${s.deleted ? " (사용자가 목록에서 삭제)" : ""}`, font: FONT, bold: true, size: 22, color: NAVY })] }));
    if (s.reasons.length) body.push(para(`경고 근거: ${s.reasons.join(" · ")}`, { size: 18, color: "B42318" }));
    body.push(para("쏘웰라 AI 평가", { bold: true, size: 19, color: NAVY, after: 40 }));
    body.push(...aiBlock(ai.perSession.get(s.code), SESSION_LABELS));
    body.push(para("대화 원문", { bold: true, size: 19, color: NAVY, after: 40 }));
    for (const m of s.messages) {
      const lv = assessMessage(m);
      const who = m.role === "user" ? "이용자" : "쏘웰라";
      body.push(new Paragraph({
        spacing: { after: 60 }, indent: { left: 200 },
        shading: lv ? { type: ShadingType.CLEAR, color: "auto", fill: SHADE[lv] } : undefined,
        children: [new TextRun({ text: `${who} (${kstDateTime(m.created_at).slice(11)}${lv ? ` · ${ALERT_LABEL[lv]}` : ""}): `, font: FONT, bold: true, size: 19, color: m.role === "user" ? "1F4E79" : "555555" }), ...runs(m.content, { size: 19 })],
      }));
    }
  }

  const doc = new Document({
    creator: "쏠 웰니스 하우스 관리자",
    title: "쏘웰라 이용 보고서(내부 검토용)",
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children: body }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
