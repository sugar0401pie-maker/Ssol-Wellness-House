import ExcelJS from "exceljs";
import { ALERT_LABEL, assessMessage, assessSession, type AlertLevel } from "./alerts.ts";
import { maskDirectHealth } from "../interp/healthMask.ts";
import { kstDateTime, type Range } from "./range.ts";
import { maskContacts, pseudonymCode } from "./privacy.ts";
import { describeApproach, type FNames, type ReportFacts } from "./reportFacts.ts";

// 엑셀(.xlsx) 만들기. 서버가 만든 값만 넣으며, 사용자가 쓴 글은 문자열 칸으로만 들어간다(엑셀이 수식으로 읽지 않는다).
const FONT = "맑은 고딕";
const FILL: Record<AlertLevel, string> = { urgent: "FFFBD5D5", watch: "FFFFF1CC" };
const CELL_MAX = 32_000; // 엑셀 한 칸 글자 수 한계(32,767)보다 조금 작게

const cell = (s: string | null | undefined) => {
  const v = s ?? "";
  return v.length > CELL_MAX ? `${v.slice(0, CELL_MAX)}…(길이 제한으로 잘림)` : v;
};

type Col = { header: string; key: string; width: number; wrap?: boolean };

function addTable(wb: ExcelJS.Workbook, name: string, cols: Col[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  const head = ws.getRow(1);
  head.font = { name: FONT, bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF033667" } };
  head.alignment = { vertical: "middle" };
  return { ws, cols };
}

function addRow(t: ReturnType<typeof addTable>, values: Record<string, string | number | null>, level: AlertLevel | null = null) {
  const row = t.ws.addRow(values);
  row.font = { name: FONT };
  row.alignment = { vertical: "top" };
  t.cols.forEach((c, i) => { if (c.wrap) row.getCell(i + 1).alignment = { vertical: "top", wrapText: true }; });
  if (level) row.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL[level] } }; });
}

function keyValueSheet(wb: ExcelJS.Workbook, name: string, rows: [string, string][]) {
  const ws = wb.addWorksheet(name);
  ws.columns = [{ width: 24 }, { width: 90 }];
  for (const [k, v] of rows) {
    const r = ws.addRow([k, cell(v)]);
    r.font = { name: FONT };
    r.getCell(1).font = { name: FONT, bold: true };
    r.getCell(2).alignment = { wrapText: true, vertical: "top" };
    r.getCell(1).alignment = { vertical: "top" };
  }
}

const who = (role: string) => (role === "user" ? "이용자" : "쏘웰라");
const flagText = (l: AlertLevel | null) => (l ? ALERT_LABEL[l] : "");

export type AccountExportInput = {
  account: { userId: string; email: string; name: string; nickname: string; provider: string; createdAt: string; code?: string; payment?: string };
  range: Range; adminEmail: string; now: Date; facts: ReportFacts; names: FNames;
};

// 한 계정의 대화 전체(원문). 시트: 요약 · 세션 · 대화원문 · 경고
export async function buildAccountWorkbook(i: AccountExportInput): Promise<Buffer> {
  const { facts, account } = i;
  const wb = new ExcelJS.Workbook();
  wb.creator = "쏠 웰니스 하우스 관리자";
  wb.created = i.now;

  keyValueSheet(wb, "요약", [
    ["⚠ 취급 주의", "내부 라운드테이블 검토 전용 자료입니다. 이용자의 대화 원문과 개인 정보가 들어 있어 외부 공유·재배포·모델 학습 사용을 하지 않습니다."],
    ["이용자 코드", account.code ?? ""], ["이름", account.name], ["닉네임", account.nickname], ["이메일", account.email], ["가입 방식", account.provider], ["가입일(KST)", kstDateTime(account.createdAt)], ["결제", account.payment ?? ""],
    ["추출 기간(KST)", i.range.label],
    ["추출 일시(KST)", kstDateTime(i.now.toISOString())], ["추출한 관리자", i.adminEmail],
    ["대화(세션) 수", String(facts.sessionCount)], ["메시지 수", `${facts.messageCount} (이용자 ${facts.userMessageCount})`], ["활동한 날 수", String(facts.activeDays)],
    ["첫·마지막 대화(KST)", `${kstDateTime(facts.firstAt)} ~ ${kstDateTime(facts.lastAt)}`],
    ["경고 단계", facts.overallLevel ? ALERT_LABEL[facts.overallLevel] : "기록된 경고 없음"],
    ["경고 근거 설명", "URGENT: 위기·폭력 경로 응답, 세션 안전 상태 crisis, 스크리닝 중단, 뿌리 상태 urgent. WATCH: 세션 안전 상태 elevated, 스크리닝 운영 검토 표시, 뿌리 상태 주의 표시."],
  ]);

  const sessions = addTable(wb, "세션", [
    { header: "세션", key: "code", width: 8 }, { header: "시작(KST)", key: "start", width: 18 }, { header: "주제", key: "topic", width: 36, wrap: true },
    { header: "메시지 수", key: "n", width: 10 }, { header: "경고", key: "level", width: 16 }, { header: "경고 근거", key: "reasons", width: 60, wrap: true }, { header: "사용자가 목록에서 삭제", key: "del", width: 12 },
  ]);
  for (const s of facts.sessions) addRow(sessions, { code: s.code, start: kstDateTime(s.startedAt), topic: cell(s.topic), n: s.messages.length, level: flagText(s.level), reasons: s.reasons.join(" · "), del: s.deleted ? "예" : "" }, s.level);

  const chat = addTable(wb, "대화원문", [
    { header: "순번", key: "no", width: 6 }, { header: "세션", key: "code", width: 8 }, { header: "일시(KST)", key: "at", width: 18 }, { header: "말한 사람", key: "who", width: 9 },
    { header: "내용(원문)", key: "text", width: 80, wrap: true }, { header: "경로", key: "route", width: 16 }, { header: "이론·접근", key: "approach", width: 42, wrap: true }, { header: "경고", key: "level", width: 16 },
  ]);
  let no = 0;
  for (const s of facts.sessions) for (const m of s.messages) {
    const lv = assessMessage(m);
    addRow(chat, { no: ++no, code: s.code, at: kstDateTime(m.created_at), who: who(m.role), text: cell(m.content), route: m.route ?? "", approach: describeApproach(m, i.names), level: flagText(lv) }, lv);
  }

  const alerts = addTable(wb, "경고", [
    { header: "세션", key: "code", width: 8 }, { header: "시작(KST)", key: "start", width: 18 }, { header: "단계", key: "level", width: 16 }, { header: "근거", key: "reasons", width: 60, wrap: true }, { header: "이용자 발언 발췌", key: "excerpt", width: 70, wrap: true },
  ]);
  if (!facts.alerts.length) addRow(alerts, { code: "", start: "", level: "", reasons: facts.rootReasons.length ? `세션 경고는 없고, ${facts.rootReasons.join(" · ")}` : "기록된 경고 없음", excerpt: "" });
  for (const a of facts.alerts) addRow(alerts, { code: a.code, start: kstDateTime(a.startedAt), level: ALERT_LABEL[a.level], reasons: a.reasons.join(" · "), excerpt: cell(a.excerpt) }, a.level);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export type BulkMessage = { session_id: string; user_id: string; role: string; content: string; route: string | null; reflection_signal_id: string | null; created_at: string; theory_id: string | null; technique_id: string | null; framework_id: string | null; dialogue_mode: string | null };
export type BulkSession = { session_id: string; user_id: string; safety_flag: string | null; topic_tag: string | null; started_at: string };
export type BulkInput = { sessions: BulkSession[]; messages: BulkMessage[]; range: Range; adminEmail: string; now: Date; includedUsers: number; excludedUsers: number; names: FNames; secret: string };

// 전체 대화 종합(내부 라운드테이블용). 계정은 되돌릴 수 없는 코드로, 글 속 연락처·건강 직접 표현은 가려서 낸다. 서비스·AI 품질 개선 활용을 거부한 계정은 애초에 빠져 있다.
export async function buildBulkWorkbook(i: BulkInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "쏠 웰니스 하우스 관리자";
  wb.created = i.now;
  const bySession = new Map<string, BulkMessage[]>();
  for (const m of i.messages) (bySession.get(m.session_id) ?? bySession.set(m.session_id, []).get(m.session_id)!).push(m);
  const code = (uid: string) => pseudonymCode(uid, i.secret);

  const assessed = i.sessions.map((s) => ({ s, a: assessSession({ safety_flag: s.safety_flag, messages: bySession.get(s.session_id) ?? [] }) }));
  const urgent = assessed.filter((x) => x.a.level === "urgent").length;
  const watch = assessed.filter((x) => x.a.level === "watch").length;

  keyValueSheet(wb, "안내", [
    ["⚠ 취급 주의", "내부 라운드테이블 검토 전용 자료입니다. 외부 공유·재배포·모델 학습 사용을 하지 않습니다."],
    ["추출 기간(KST)", i.range.label], ["추출 일시(KST)", kstDateTime(i.now.toISOString())], ["추출한 관리자", i.adminEmail],
    ["포함된 이용자", `${i.includedUsers}명 · 대화 ${i.sessions.length}개 · 메시지 ${i.messages.length}개`],
    ["제외된 이용자", `${i.excludedUsers}명 (서비스·AI 품질 개선 활용을 거부했거나 동의 여부를 알 수 없는 계정 — 약관·방침 예고문의 약속에 따라 뺐어요)`],
    ["식별 줄이기", "이용자는 U-XXXXXXXX 코드로만 표시하며(같은 사람은 항상 같은 코드, 코드로 계정을 되짚을 수 없음), 글 속 전화번호·이메일·주민번호와 질병명·진단·약 같은 건강 직접 표현은 가렸어요. 이름·장소처럼 풀어서 쓴 정보는 남아 있을 수 있어요."],
    ["경고 요약", `URGENT ${urgent}개 대화 · WATCH ${watch}개 대화`],
  ]);

  const ses = addTable(wb, "세션", [
    { header: "이용자 코드", key: "u", width: 14 }, { header: "세션 id(앞 8자)", key: "id", width: 14 }, { header: "시작(KST)", key: "start", width: 18 }, { header: "주제", key: "topic", width: 36, wrap: true },
    { header: "메시지 수", key: "n", width: 10 }, { header: "경고", key: "level", width: 16 }, { header: "경고 근거", key: "reasons", width: 60, wrap: true },
  ]);
  for (const { s, a } of assessed) addRow(ses, { u: code(s.user_id), id: s.session_id.slice(0, 8), start: kstDateTime(s.started_at), topic: cell(maskContacts(maskDirectHealth(s.topic_tag ?? "").text)), n: (bySession.get(s.session_id) ?? []).length, level: flagText(a.level), reasons: a.reasons.join(" · ") }, a.level);

  const chat = addTable(wb, "대화", [
    { header: "이용자 코드", key: "u", width: 14 }, { header: "세션 id(앞 8자)", key: "id", width: 14 }, { header: "일시(KST)", key: "at", width: 18 }, { header: "말한 사람", key: "who", width: 9 },
    { header: "내용(가림 처리됨)", key: "text", width: 80, wrap: true }, { header: "경로", key: "route", width: 16 }, { header: "이론·접근", key: "approach", width: 42, wrap: true }, { header: "경고", key: "level", width: 16 },
  ]);
  for (const { s } of assessed) for (const m of bySession.get(s.session_id) ?? []) {
    const lv = assessMessage(m);
    addRow(chat, { u: code(s.user_id), id: s.session_id.slice(0, 8), at: kstDateTime(m.created_at), who: who(m.role), text: cell(maskContacts(maskDirectHealth(m.content).text)), route: m.route ?? "", approach: describeApproach(m, i.names), level: flagText(lv) }, lv);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
