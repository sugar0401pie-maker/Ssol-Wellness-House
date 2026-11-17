// 대시보드 숫자 계산(순수 함수 — DB 접근 없음, 시험 가능: dashboard.test.ts). 읽어 오는 일은 data.ts가 한다.
import { assessRootStates, assessSession, maxLevel, type AlertLevel } from "./alerts.ts";
import { kstDay } from "./range.ts";

export type AuthRow = { id: string; email: string; createdAt: string; lastSignInAt: string | null; anonymous: boolean; provider: string; metaNames: string[] };
export type ProfileRow = { user_id: string; display_name: string | null; nickname: string | null; terms_agreed_at: string | null; ai_training_consent: boolean | null };
export type Ent = { user_id: string; plan: string; status: string; amount: number | null; expires_at: string | null; toss_payment_key: string | null };
export type Order = { user_id: string | null; status: string; amount: number | null };
export type Msg = { session_id: string; user_id: string; role: string; route: string | null; reflection_signal_id: string | null; created_at: string };
export type Ses = { session_id: string; user_id: string; safety_flag: string | null; started_at: string };
export type Root = { user_id: string; caution_hold: boolean | null; safety2_level: string | null };

// 계산만 하는 부분(DB 접근 없음) — 시험이 쉽도록 분리.
export function summarizeDashboard(d: { users: AuthRow[]; profiles: ProfileRow[]; sessions: Ses[]; messages: Msg[]; ents: Ent[]; orders: Order[]; roots: Root[] }, now: Date) {
  const today = kstDay(now);
  const dayAgo = (n: number) => kstDay(now.getTime() - n * 86_400_000);
  const real = d.users.filter((u) => !u.anonymous);
  const realIds = new Set(real.map((u) => u.id));
  const byProvider: Record<string, number> = {};
  for (const u of real) byProvider[u.provider] = (byProvider[u.provider] ?? 0) + 1;

  // 쏘웰라 가입자 = 앱 회원가입 때 약관 동의가 기록된 사람(auth.users는 퀴즈·결제 사이트와 공유라 계정 수 ≠ 쏘웰라 가입자).
  const agreed = new Set(d.profiles.filter((p) => p.terms_agreed_at && realIds.has(p.user_id)).map((p) => p.user_id));
  const createdOf = new Map(real.map((u) => [u.id, u.createdAt]));
  const signupsOn = (day: string) => [...agreed].filter((id) => kstDay(createdOf.get(id)!) === day).length;
  const signupsSince = (day: string) => [...agreed].filter((id) => kstDay(createdOf.get(id)!) >= day).length;

  const userMsgs = d.messages.filter((m) => m.role === "user" && realIds.has(m.user_id));
  const chatters = new Set(userMsgs.map((m) => m.user_id));
  const activeSince = (day: string) => new Set(userMsgs.filter((m) => kstDay(m.created_at) >= day).map((m) => m.user_id)).size;
  const activeOn = (day: string) => new Set(userMsgs.filter((m) => kstDay(m.created_at) === day).map((m) => m.user_id)).size;
  const realSessions = d.sessions.filter((s) => realIds.has(s.user_id));

  // 결제: 이용권 표(chat_entitlements). 토스 결제 키가 있으면 자동 결제, 없으면 수동 승인(계좌이체·오프라인 패키지 등). pending은 신청만 한 상태라 결제로 세지 않는다.
  const paidEnts = d.ents.filter((e) => e.status === "active" || e.status === "expired");
  const tossUsers = new Set(paidEnts.filter((e) => e.toss_payment_key).map((e) => e.user_id));
  const manualUsers = new Set(paidEnts.filter((e) => !e.toss_payment_key).map((e) => e.user_id));
  const payers = new Set([...tossUsers, ...manualUsers]);
  const byPlan: Record<string, number> = {};
  for (const e of paidEnts) byPlan[e.plan] = (byPlan[e.plan] ?? 0) + 1;
  const activeNow = new Set(d.ents.filter((e) => e.status === "active" && (!e.expires_at || new Date(e.expires_at) > now)).map((e) => e.user_id));
  const pendingUsers = new Set(d.ents.filter((e) => e.status === "pending").map((e) => e.user_id));
  const entRevenue = paidEnts.reduce((s, e) => s + (e.amount ?? 0), 0);
  const paidOrders = d.orders.filter((o) => o.status === "paid");
  const orderBuyers = new Set(paidOrders.map((o) => o.user_id).filter((x): x is string => !!x));

  // 경고(alert): 세션별로 판정하고 계정 단위로 모은다.
  const msgBySession = new Map<string, Msg[]>();
  for (const m of d.messages) (msgBySession.get(m.session_id) ?? msgBySession.set(m.session_id, []).get(m.session_id)!).push(m);
  const emailOf = new Map(d.users.map((u) => [u.id, u.email]));
  const alertSessions: { sessionId: string; userId: string; email: string; level: AlertLevel; reasons: string[]; startedAt: string }[] = [];
  for (const s of realSessions) {
    const a = assessSession({ safety_flag: s.safety_flag, messages: msgBySession.get(s.session_id) ?? [] });
    if (a.level) alertSessions.push({ sessionId: s.session_id, userId: s.user_id, email: emailOf.get(s.user_id) ?? "", level: a.level, reasons: a.reasons, startedAt: s.started_at });
  }
  const rootByUser = new Map<string, Root[]>();
  for (const r of d.roots) (rootByUser.get(r.user_id) ?? rootByUser.set(r.user_id, []).get(r.user_id)!).push(r);
  const accountLevel = new Map<string, AlertLevel>();
  for (const a of alertSessions) accountLevel.set(a.userId, maxLevel(accountLevel.get(a.userId) ?? null, a.level)!);
  for (const [uid, rows] of rootByUser) { const lv = assessRootStates(rows).level; if (lv && realIds.has(uid)) accountLevel.set(uid, maxLevel(accountLevel.get(uid) ?? null, lv)!); }
  const lvCount = (lv: AlertLevel) => [...accountLevel.values()].filter((x) => x === lv).length;
  const lvSessions = (lv: AlertLevel) => alertSessions.filter((a) => a.level === lv).length;

  const daily = Array.from({ length: 14 }, (_, i) => {
    const day = dayAgo(13 - i);
    return { day, signups: signupsOn(day), activeUsers: activeOn(day) };
  });

  return {
    asOf: now.toISOString(),
    accounts: { realAccounts: real.length, sharedAccounts: d.users.length, signedUp: agreed.size, signupsToday: signupsOn(today), signups7d: signupsSince(dayAgo(6)), signups30d: signupsSince(dayAgo(29)), byProvider },
    usage: {
      chatters: chatters.size, activeToday: activeOn(today), active7d: activeSince(dayAgo(6)), active30d: activeSince(dayAgo(29)),
      sessions: realSessions.length, userMessages: userMsgs.length, totalMessages: d.messages.filter((m) => realIds.has(m.user_id)).length,
      avgSessionsPerChatter: chatters.size ? Math.round((realSessions.length / chatters.size) * 10) / 10 : 0,
    },
    payments: {
      payers: payers.size, tossPayers: tossUsers.size, manualPayers: manualUsers.size, revenue: entRevenue, activeNow: activeNow.size, pending: pendingUsers.size, byPlan,
      reportBuyers: orderBuyers.size, reportOrders: paidOrders.length, reportRevenue: paidOrders.reduce((s, o) => s + (o.amount ?? 0), 0),
    },
    safety: {
      urgentAccounts: lvCount("urgent"), watchAccounts: lvCount("watch"), urgentSessions: lvSessions("urgent"), watchSessions: lvSessions("watch"),
      recent: alertSessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 15),
    },
    daily,
  };
}


export type Dashboard = ReturnType<typeof summarizeDashboard>;
