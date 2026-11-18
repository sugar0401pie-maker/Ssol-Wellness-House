import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { annotateExplicit, assessRootStates, assessSession, maxLevel, type AlertLevel } from "./alerts.ts";
import { getSafetyData } from "@/lib/safety/rules";
import { findKeywordHits } from "@/lib/safety/keywordCheck";
import { type Range } from "./range.ts";
import { normalizeUserCode, pseudonymCode } from "./privacy.ts";
import { summarizeDashboard, type AuthRow, type Ent, type Msg, type Order, type ProfileRow, type Root, type Ses } from "./dashboard.ts";

export type { AuthRow, ProfileRow };

// 관리자 화면이 쓰는 모든 DB 조회(읽기 전용). 서비스 키로 읽으므로 이 모듈은 반드시 lib/admin/server.ts의 requireAdmin을 통과한 API에서만 부른다.
// 쓰기는 하지 않는다. ssol_* 표(퀴즈·결제 사이트 소유)는 읽기만 한다.
const db = () => createAdminClient();

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
async function pageAll<T>(q: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

// ───── 계정 ─────

export async function listAuthUsers(): Promise<AuthRow[]> {
  const out: AuthRow[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db().auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`계정 목록: ${error.message}`);
    for (const u of data.users) {
      const m = (u.user_metadata ?? {}) as Record<string, unknown>;
      const names = ["display_name", "name", "full_name", "nickname", "preferred_username"].map((k) => m[k]).filter((v): v is string => typeof v === "string" && !!v.trim());
      out.push({ id: u.id, email: u.email ?? "", createdAt: u.created_at, lastSignInAt: u.last_sign_in_at ?? null, anonymous: u.is_anonymous === true, provider: (u.app_metadata?.provider as string | undefined) ?? "email", metaNames: names });
    }
    if (data.users.length < 1000) return out;
  }
}

const loadProfiles = () => pageAll<ProfileRow>((a, b) => db().from("profiles").select("user_id,display_name,nickname,terms_agreed_at,ai_training_consent").order("user_id").range(a, b));

export type AccountInfo = {
  userId: string; email: string; name: string; nickname: string; provider: string; createdAt: string; lastSignInAt: string | null;
  termsAgreedAt: string | null; aiTrainingConsent: boolean | null;
};

const toInfo = (u: AuthRow, p?: ProfileRow): AccountInfo => ({
  userId: u.id, email: u.email, name: p?.display_name ?? u.metaNames[0] ?? "", nickname: p?.nickname ?? "", provider: u.provider, createdAt: u.createdAt,
  lastSignInAt: u.lastSignInAt, termsAgreedAt: p?.terms_agreed_at ?? null, aiTrainingConsent: p?.ai_training_consent ?? null,
});

export async function loadAccount(userId: string): Promise<AccountInfo | null> {
  const { data, error } = await db().auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  const u = data.user;
  const { data: p } = await db().from("profiles").select("user_id,display_name,nickname,terms_agreed_at,ai_training_consent").eq("user_id", userId).maybeSingle();
  const m = (u.user_metadata ?? {}) as Record<string, unknown>;
  const names = ["display_name", "name", "full_name", "nickname"].map((k) => m[k]).filter((v): v is string => typeof v === "string" && !!v.trim());
  return toInfo({ id: u.id, email: u.email ?? "", createdAt: u.created_at, lastSignInAt: u.last_sign_in_at ?? null, anonymous: u.is_anonymous === true, provider: (u.app_metadata?.provider as string | undefined) ?? "email", metaNames: names }, (p as ProfileRow | null) ?? undefined);
}

export type AccountHit = AccountInfo & { code: string; sessions: number; messages: number; lastMessageAt: string | null; alert: AlertLevel | null };

// 이메일·이름·닉네임의 일부, 또는 이용자 코드(U-XXXXXXXX — 종합 내보내기·검토 엑셀에 나오는 코드)로 계정을 최대 20개 찾는다(대소문자·공백 무시).
// 코드는 계정 id에서 되돌려 만들 수 없어서, 계정마다 코드를 다시 계산해 같은 것을 찾는다(codeSecret은 종합 내보내기와 같은 값).
export async function searchAccounts(q: string, codeSecret: string): Promise<AccountHit[]> {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  const code = codeSecret ? normalizeUserCode(q) : null;
  const [users, profiles] = await Promise.all([listAuthUsers(), loadProfiles()]);
  const pMap = new Map(profiles.map((p) => [p.user_id, p]));
  const hits = users
    .filter((u) => !u.anonymous)
    .map((u) => ({ u, p: pMap.get(u.id) }))
    .filter(({ u, p }) => (code ? pseudonymCode(u.id, codeSecret) === code : [u.email, p?.display_name, p?.nickname, ...u.metaNames].some((s) => (s ?? "").toLowerCase().includes(needle))))
    .sort((a, b) => Number((b.u.email.toLowerCase() === needle)) - Number(a.u.email.toLowerCase() === needle))
    .slice(0, 20);
  const out: AccountHit[] = [];
  for (const { u, p } of hits) {
    const { sessions, messages } = await loadAccountChats(u.id, { fromIso: null, toIso: null, label: "" });
    const roots = await loadRootStates(u.id);
    let level: AlertLevel | null = assessRootStates(roots).level;
    for (const s of sessions) level = maxLevel(level, assessSession({ safety_flag: s.safety_flag, messages: messages.filter((m) => m.session_id === s.session_id) }).level);
    out.push({ ...toInfo(u, p), code: codeSecret ? pseudonymCode(u.id, codeSecret) : "", sessions: sessions.length, messages: messages.length, lastMessageAt: messages.at(-1)?.created_at ?? null, alert: level });
  }
  return out;
}


// 위기·폭력 고정 안내가 "이용자가 직접 위험 표현을 해서(키워드 즉시 판정)" 나간 것인지 알아내는 판정기. 라우터가 쓰는 것과 같은 키워드 규칙을 그대로 쓴다.
// 규칙을 DB에서 읽지 못해 최소 안전망만 쓰는 상태(loadedAt=0)에서는 값을 모른다고 답한다 — 모르면 낮추지 않는다(lib/admin/alerts.ts).
async function explicitChecker(): Promise<(text: string, kind: string) => boolean | undefined> {
  const data = await getSafetyData();
  if (data.loadedAt === 0) return () => undefined;
  return (text, kind) => findKeywordHits(text, data.rules).some((h) => !h.weak && h.route === kind);
}

async function withExplicit(messages: MessageRow[]): Promise<MessageRow[]> {
  if (!messages.some((m) => m.route === "crisis" || m.route === "violence")) return messages;
  const check = await explicitChecker();
  return annotateExplicit(messages, (m) => check(m.content, m.route as string));
}

// ───── 대화 ─────
export type SessionRow = { session_id: string; user_id: string; safety_flag: string | null; topic_tag: string | null; started_at: string; last_message_at: string; deleted_at: string | null };
export type MessageRow = {
  message_id: string; session_id: string; user_id: string; role: "user" | "assistant"; content: string; route: string | null; framework_id: string | null;
  theory_id: string | null; technique_id: string | null; dialogue_mode: string | null; reflection_signal_id: string | null; created_at: string;
  explicit?: boolean;
};
const MSG_COLS = "message_id,session_id,user_id,role,content,route,framework_id,theory_id,technique_id,dialogue_mode,reflection_signal_id,created_at";
const SES_COLS = "session_id,user_id,safety_flag,topic_tag,started_at,last_message_at,deleted_at";

// 기간은 "메시지가 쓰인 시각" 기준이다. 사용자가 목록에서 삭제한 대화도 DB에는 남아 있어 포함한다(deleted_at으로 구분해 표시).
export async function loadAccountChats(userId: string, range: Range): Promise<{ sessions: SessionRow[]; messages: MessageRow[] }> {
  const messages = await withExplicit(await pageAll<MessageRow>((a, b) => {
    let q = db().from("chat_messages").select(MSG_COLS).eq("user_id", userId);
    if (range.fromIso) q = q.gte("created_at", range.fromIso);
    if (range.toIso) q = q.lt("created_at", range.toIso);
    return q.order("created_at").order("message_id").range(a, b);
  }));
  const ids = [...new Set(messages.map((m) => m.session_id))];
  const sessions: SessionRow[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db().from("chat_sessions").select(SES_COLS).in("session_id", ids.slice(i, i + 100));
    if (error) throw new Error(`대화 목록: ${error.message}`);
    sessions.push(...((data ?? []) as SessionRow[]));
  }
  sessions.sort((a, b) => a.started_at.localeCompare(b.started_at));
  return { sessions, messages };
}

export type RootStateRow = { root_id: string; caution_hold: boolean | null; safety2_level: string | null; safety2_at: string | null };
export async function loadRootStates(userId: string): Promise<RootStateRow[]> {
  const { data, error } = await db().from("sw_user_root_state").select("root_id,caution_hold,safety2_level,safety2_at").eq("user_id", userId);
  if (error) return []; // 표가 없거나 읽기 실패 — 경고 판정에서만 빠진다(대화 내려받기는 계속)
  return (data ?? []) as RootStateRow[];
}

// 이론 이름표: 이론(TH-…)·기법·"뿌리 → 주 이론" 연결. 읽기 실패 시 빈 표(아이디만 보인다).
export type TheoryNames = { theory: Map<string, string>; technique: Map<string, string>; rootMainTheory: Map<string, string> };
export async function loadTheoryNames(): Promise<TheoryNames> {
  const [t, k, r] = await Promise.all([
    db().from("counseling_theories").select("theory_id,internal_name"),
    db().from("theory_techniques").select("technique_id,name"),
    db().from("sw_ob_root_theory").select("root_id,theory_id,rank").eq("rank", 1),
  ]);
  return {
    theory: new Map(((t.data ?? []) as { theory_id: string; internal_name: string }[]).map((x) => [x.theory_id, x.internal_name])),
    technique: new Map(((k.data ?? []) as { technique_id: string; name: string }[]).map((x) => [x.technique_id, x.name])),
    rootMainTheory: new Map(((r.data ?? []) as { root_id: string; theory_id: string }[]).map((x) => [x.root_id, x.theory_id])),
  };
}

// 종합(전체) 내보내기 대상: 서비스·AI 품질 개선 활용을 거부하지 않은 계정의 대화만. 동의 여부를 알 수 없는 계정(프로필 없음)은 제외한다(안전 쪽).
export async function loadAllChats(range: Range): Promise<{ sessions: SessionRow[]; messages: MessageRow[]; excludedUsers: number; includedUsers: number }> {
  const profiles = await loadProfiles();
  const consented = new Set(profiles.filter((p) => p.ai_training_consent !== false).map((p) => p.user_id));
  const messages = await withExplicit(await pageAll<MessageRow>((a, b) => {
    let q = db().from("chat_messages").select(MSG_COLS);
    if (range.fromIso) q = q.gte("created_at", range.fromIso);
    if (range.toIso) q = q.lt("created_at", range.toIso);
    return q.order("created_at").order("message_id").range(a, b);
  }));
  const allUsers = new Set(messages.map((m) => m.user_id));
  const keep = messages.filter((m) => consented.has(m.user_id));
  const keepUsers = new Set(keep.map((m) => m.user_id));
  const ids = [...new Set(keep.map((m) => m.session_id))];
  const sessions: SessionRow[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db().from("chat_sessions").select(SES_COLS).in("session_id", ids.slice(i, i + 100));
    if (error) throw new Error(`대화 목록: ${error.message}`);
    sessions.push(...((data ?? []) as SessionRow[]));
  }
  sessions.sort((a, b) => a.started_at.localeCompare(b.started_at));
  return { sessions, messages: keep, excludedUsers: allUsers.size - keepUsers.size, includedUsers: keepUsers.size };
}

// ───── 대시보드 ─────
export async function loadDashboard() {
  const [users, profiles, sessions, messages, ents, orders, roots] = await Promise.all([
    listAuthUsers(),
    loadProfiles(),
    pageAll<Ses>((a, b) => db().from("chat_sessions").select("session_id,user_id,safety_flag,started_at").order("session_id").range(a, b)),
    pageAll<Msg & { message_id: string }>((a, b) => db().from("chat_messages").select("message_id,session_id,user_id,role,route,reflection_signal_id,created_at").order("message_id").range(a, b)),
    pageAll<Ent>((a, b) => db().from("chat_entitlements").select("user_id,plan,status,amount,expires_at,toss_payment_key").order("id").range(a, b)),
    pageAll<Order>((a, b) => db().from("ssol_orders").select("user_id,status,amount").order("id").range(a, b)).catch(() => [] as Order[]), // 퀴즈·결제 사이트 표 — 읽기만, 못 읽어도 대시보드는 계속
    pageAll<Root>((a, b) => db().from("sw_user_root_state").select("user_id,caution_hold,safety2_level").order("user_id").order("root_id").range(a, b)).catch(() => [] as Root[]),
  ]);
  // 위기·폭력 경로의 이용자 메시지만 글을 읽어 명시적 표현 여부를 매긴다(전체 글을 읽지 않는다).
  const danger = await pageAll<{ message_id: string; content: string }>((a, b) => db().from("chat_messages").select("message_id,content").eq("role", "user").in("route", ["crisis", "violence"]).order("message_id").range(a, b)).catch(() => []);
  const text = new Map(danger.map((d) => [d.message_id, d.content]));
  const check = await explicitChecker();
  const annotated = annotateExplicit(messages, (m) => { const c = text.get(m.message_id); return c === undefined ? undefined : check(c, m.route as string); });
  return summarizeDashboard({ users, profiles, sessions, messages: annotated, ents, orders, roots }, new Date());
}

