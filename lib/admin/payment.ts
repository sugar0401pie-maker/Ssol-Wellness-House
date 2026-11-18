// 한 계정의 결제 요약(순수 함수 — 시험: payment.test.ts). 대시보드의 "결제" 숫자와 같은 기준을 쓴다:
//  · 이용권(chat_entitlements): active·expired만 결제로 센다. pending은 신청만 한 상태라 결제 아님. 토스 결제 키가 있으면 토스, 없으면 수동 승인(계좌이체·오프라인 등).
//  · 심층 보고서(ssol_orders, 퀴즈·결제 사이트 소유 — 읽기만): status=paid만.
export type EntRow = { plan: string; status: string; amount: number | null; starts_at?: string | null; expires_at: string | null; toss_payment_key: string | null; created_at?: string | null };
export type OrderRow = { status: string; amount: number | null; report_kind?: string | null; paid_at?: string | null; created_at?: string | null };

export type PaymentSummary = {
  paid: boolean;            // 이용권이든 보고서든 실제 결제가 한 번이라도 있는가
  passPaid: number;         // 결제된 이용권 건수
  passToss: number;
  passManual: number;
  passAmount: number;
  activeNow: boolean;       // 지금 이용 중인 이용권이 있는가
  activeUntil: string | null; // 이용 중인 이용권 중 가장 늦은 만료일(무기한이면 null + unlimited)
  unlimited: boolean;
  pending: number;          // 신청만 하고 결제 전
  reportPaid: number;
  reportAmount: number;
  label: string;            // 화면·파일에 그대로 쓰는 한 줄
};

const PLAN: Record<string, string> = { monthly: "1개월", quarterly: "3개월", annual: "연간", offline_package: "오프라인 패키지" };
const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const day = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(iso));

export function summarizePayment(ents: EntRow[], orders: OrderRow[], now: Date): PaymentSummary {
  const paid = ents.filter((e) => e.status === "active" || e.status === "expired");
  const active = ents.filter((e) => e.status === "active" && (!e.expires_at || new Date(e.expires_at) > now));
  const unlimited = active.some((e) => !e.expires_at);
  const activeUntil = unlimited || !active.length ? null : active.map((e) => e.expires_at!).sort().at(-1)!;
  const reports = orders.filter((o) => o.status === "paid");
  const s = {
    paid: paid.length > 0 || reports.length > 0,
    passPaid: paid.length,
    passToss: paid.filter((e) => e.toss_payment_key).length,
    passManual: paid.filter((e) => !e.toss_payment_key).length,
    passAmount: paid.reduce((n, e) => n + (e.amount ?? 0), 0),
    activeNow: active.length > 0,
    activeUntil,
    unlimited,
    pending: ents.filter((e) => e.status === "pending").length,
    reportPaid: reports.length,
    reportAmount: reports.reduce((n, o) => n + (o.amount ?? 0), 0),
  };
  const parts: string[] = [];
  if (s.passPaid) {
    const plans = [...new Set(paid.map((e) => PLAN[e.plan] ?? e.plan))].join("·");
    parts.push(`이용권 결제 ${s.passPaid}건(${plans}, ${[s.passToss ? `토스 ${s.passToss}` : "", s.passManual ? `수동 ${s.passManual}` : ""].filter(Boolean).join(" · ")}, ${won(s.passAmount)})`);
  }
  if (s.activeNow) parts.push(s.unlimited ? "지금 이용 중(기한 없음)" : `지금 이용 중(~${day(s.activeUntil!)})`);
  else if (s.passPaid) parts.push("이용권 만료");
  if (s.pending) parts.push(`결제 대기(신청만) ${s.pending}건`);
  if (s.reportPaid) parts.push(`심층 보고서 구매 ${s.reportPaid}건(${won(s.reportAmount)})`);
  return { ...s, label: parts.length ? parts.join(" · ") : "결제 없음" };
}
