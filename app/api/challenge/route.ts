import { NextRequest, NextResponse } from "next/server";
import { getUserIdFast, getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { todayKeyKST } from "@/lib/safety/dailyLimit";
import { CHALLENGE_DAYS, METHODS, deriveView, keepInHistory, normalizeMemo, startDayFor, type Challenge, type Checkin, type Method } from "@/lib/challenge/state";
import { DEFAULT_THEME, isThemeKey } from "@/lib/challenge/themes";
import { ENGINE_KEY, TAROT_KEY, planOf, themePlan, type PlanView } from "@/lib/challenge/planView";
import { engineChallenge, tarotChallenge } from "@/lib/challenge/enginePlan";
import { isLanternOpen, lanternPeriod } from "@/lib/lantern/config";
import { loadAccessStatus } from "@/lib/billing/loadAccess";
import { REWARD_DAYS, rewardMinStart } from "@/lib/challenge/reward";

// 작심삼일 챌린지(갓생러모임, 요청문 v1.9.4 3·9·13장). 날짜는 서버의 한국 날짜만 믿는다(기기 시계 무시).
// GET: 지금 챌린지·기록·리워드를 받았는지 · POST {op}: start(시작) · checkin(오늘 저장 — 메모·행동·방식, 사진은 서버에 안 올림) · restart(또심삼일·다시 시작 → 기록으로).
// 리워드: 처음 3번을 채운 순간 challenge_rewards에 계정당 한 줄(기본 키) → 쏘웰라 7일권 지급(2026-11-26, grantReward).
// 오늘 전에 이미 3번을 채운 계정도 챌린지 화면을 열 때(GET) 아직 안 받았으면 같은 함수로 받는다.
export const runtime = "nodejs";

type Admin = ReturnType<typeof createAdminClient>;
type Row = { id: string; seq: number; theme: string; started_day: string; status: Challenge["status"]; ended_day: string | null; end_reason: string | null; closed_at: string | null; source: string | null; plan: unknown };
type RwRow = { user_id: string; granted_at: string | null; entitlement_id: string | null };
type CkRow = { challenge_id: string; n: number; day_kst: string; method: Method; memo: string | null; action: string };

const toChallenge = (r: Row, cks: CkRow[]): Challenge => ({
  id: r.id, seq: r.seq, theme: r.theme, source: r.source ?? "theme", plan: r.plan ?? null, startedDay: r.started_day, status: r.status, endedDay: r.ended_day, endReason: r.end_reason,
  checkins: cks.filter((c) => c.challenge_id === r.id).sort((a, b) => a.n - b.n).map((c): Checkin => ({ n: c.n, day: c.day_kst, method: c.method, memo: c.memo, action: c.action })),
});

async function loadState(admin: Admin, userId: string, today: string) {
  const [chs, cks, rw] = await Promise.all([
    admin.from("challenges").select("id,seq,theme,started_day,status,ended_day,end_reason,closed_at,source,plan").eq("user_id", userId).order("seq", { ascending: false }).limit(20),
    admin.from("challenge_checkins").select("challenge_id,n,day_kst,method,memo,action").eq("user_id", userId).order("day_kst", { ascending: false }).limit(80),
    admin.from("challenge_rewards").select("user_id,granted_at,entitlement_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (chs.error || cks.error) throw new Error(chs.error?.code ?? cks.error?.code ?? "load");
  const rows = (chs.data ?? []) as Row[];
  const ckRows = (cks.data ?? []) as CkRow[];
  const openRow = rows.find((r) => !r.closed_at) ?? null;
  const current = openRow ? toChallenge(openRow, ckRows) : null;
  const history = rows.filter((r) => r.closed_at).map((r) => toChallenge(r, ckRows)).filter(keepInHistory);
  if (rw.error) console.error("챌린지 리워드 조회 실패:", rw.error.code);
  const rwRow = (rw.data ?? null) as RwRow | null;
  const rewarded = !rw.error && !!rwRow;
  const reward = rwRow ? await rewardStatus(admin, userId, rwRow) : null;
  const checkedInToday = ckRows.some((c) => c.day_kst === today);
  // 이벤트 기간(풍등과 같은 기간 — 요청문 0장 4번): 홈 배너 ②는 이 기간에만 보인다. 챌린지 자체는 기간과 상관없이 할 수 있다.
  const eventOpen = isLanternOpen(today, lanternPeriod(process.env as { SW_LANTERN_START?: string; SW_LANTERN_END?: string }));
  return { today, current, history, rewarded, reward, checkedInToday, eventOpen, view: deriveView(current, today, rewarded) };
}

// 7일권 상태 — 이미 받았으면 그 만료일, 아직 안 받았으면 지금 지급한다(DB 함수가 계정당 한 번만 — 동시에 와도 한 번).
// 지급이 실패해도 챌린지 화면은 그대로 열린다(다음에 열 때 다시 시도). 받은 것처럼 보이게 하지는 않는다(granted: false).
async function rewardStatus(admin: Admin, userId: string, row: RwRow): Promise<{ granted: boolean; expiresAt: string | null }> {
  if (row.granted_at) {
    if (!row.entitlement_id) return { granted: true, expiresAt: null };
    const { data } = await admin.from("chat_entitlements").select("expires_at").eq("id", row.entitlement_id).maybeSingle();
    return { granted: true, expiresAt: (data?.expires_at as string | null | undefined) ?? null };
  }
  return grantReward(admin, userId);
}

async function grantReward(admin: Admin, userId: string): Promise<{ granted: boolean; expiresAt: string | null }> {
  try {
    const access = await loadAccessStatus(admin, userId);
    const { data, error } = await admin.rpc("grant_challenge_reward", { p_user: userId, p_min_start: rewardMinStart(access), p_days: REWARD_DAYS });
    if (error) {
      console.error("챌린지 리워드(7일권) 지급 실패:", error.code);
      return { granted: false, expiresAt: null };
    }
    const r = (Array.isArray(data) ? data[0] : data) as { granted: boolean; expires_at: string | null } | null;
    return { granted: !!r?.expires_at, expiresAt: r?.expires_at ?? null };
  } catch (e) {
    console.error("챌린지 리워드(7일권) 지급 실패:", (e as Error).message);
    return { granted: false, expiresAt: null };
  }
}

async function auth(req: NextRequest, fast: boolean) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) return { error: NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 }) };
  const h = req.headers.get("authorization");
  const userId = fast ? await getUserIdFast(h) : await getUserIdFromAuthHeader(h);
  if (!userId) return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  return { userId };
}

const fail = (message: string, status = 500) => NextResponse.json({ ok: false, message }, { status });

async function suggestFor(admin: Admin, userId: string): Promise<"tarot" | "me" | "questions"> {
  const [tarot, { data: ob }] = await Promise.all([
    tarotChallenge(admin, userId).catch(() => null),
    admin.from("user_onboarding").select("values_ranked,hobbies_ranked,weekends_ranked").eq("user_id", userId).maybeSingle(),
  ]);
  if (tarot) return "tarot";
  const has = (v: unknown) => Array.isArray(v) && v.length > 0;
  return ob && (has(ob.values_ranked) || has(ob.hobbies_ranked) || has(ob.weekends_ranked)) ? "me" : "questions";
}

export async function GET(req: NextRequest) {
  const a = await auth(req, true);
  if ("error" in a) return a.error;
  const admin = createAdminClient();
  const q = req.nextUrl.searchParams;
  try {
    // 시작 화면 미리보기(2026-11-26): ?plan=me&s=셔플번째 → 엔진이 고른 계획 · ?plan=tarot → 타로가 준 계획
    if (q.get("plan") === ENGINE_KEY) {
      const { plan, hasAnswers } = await engineChallenge(admin, a.userId, Number(q.get("s") ?? 0) || 0);
      return NextResponse.json({ ok: true, plan, hasAnswers });
    }
    if (q.get("plan") === TAROT_KEY) return NextResponse.json({ ok: true, plan: await tarotChallenge(admin, a.userId) });
    const s = await loadState(admin, a.userId, todayKeyKST());
    // 시작 전이면 첫 화면에 어떤 길을 먼저 보여 줄지: 타로 계획이 있으면 tarot · 질문 3개 답이 있으면 me · 없으면 질문 3개 권유
    const suggest = s.view.kind === "pre" ? await suggestFor(admin, a.userId) : null;
    return NextResponse.json({ ok: true, ...s, suggest });
  } catch (e) {
    console.error("챌린지 불러오기 실패:", (e as Error).message);
    return fail("챌린지를 불러오지 못했어요. 잠시 후 다시 열어 주세요.");
  }
}

export async function POST(req: NextRequest) {
  const a = await auth(req, false);
  if ("error" in a) return a.error;
  const body = (await req.json().catch(() => null)) as { op?: string; theme?: unknown; shuffle?: unknown; method?: unknown; memo?: unknown } | null;
  const admin = createAdminClient();
  const today = todayKeyKST();
  try {
    const s = await loadState(admin, a.userId, today);

    if (body?.op === "start") {
      if (s.current) return NextResponse.json({ ok: true, ...s }); // 이미 있으면 그대로(두 번 눌러도 하나)
      const top = await admin.from("challenges").select("seq").eq("user_id", a.userId).order("seq", { ascending: false }).limit(1);
      const seq = (((top.data ?? [])[0] as { seq?: number } | undefined)?.seq ?? 0) + 1;
      // 계획은 서버가 다시 만든다(화면이 보낸 글을 믿지 않음) — 엔진·타로 계획은 시작할 때의 글을 plan에 그대로 남긴다.
      let plan: PlanView;
      if (body.theme === ENGINE_KEY) {
        const r = await engineChallenge(admin, a.userId, Number(body.shuffle ?? 0) || 0);
        if (!r.plan) return fail("나에게 맞는 챌린지를 만들지 못했어요. 아래 세 가지 중에서 골라 주세요.", 409);
        plan = r.plan;
      } else if (body.theme === TAROT_KEY) {
        const t = await tarotChallenge(admin, a.userId);
        if (!t) return fail("타로에서 받은 챌린지를 찾지 못했어요. 아래 세 가지 중에서 골라 주세요.", 409);
        plan = t;
      } else plan = themePlan(isThemeKey(body.theme) ? body.theme : DEFAULT_THEME);
      const { error } = await admin.from("challenges").insert({
        user_id: a.userId, seq, theme: plan.key, started_day: startDayFor(today, s.checkedInToday),
        source: plan.source, plan: plan.source === "theme" ? null : plan, family_id: plan.familyId ?? null,
      });
      if (error && error.code !== "23505") throw new Error(error.code);
      return NextResponse.json({ ok: true, ...(await loadState(admin, a.userId, today)) });
    }

    if (body?.op === "checkin") {
      const c = s.current;
      if (!c || s.view.kind !== "todo") return NextResponse.json({ ok: false, reason: "not_today", message: "오늘 인증 끝! 내일 또 만나요~", ...s }, { status: 409 });
      const method = METHODS.includes(body.method as Method) ? (body.method as Method) : null;
      if (!method) return fail("인증 방식을 골라 주세요.", 400);
      // 대표님 2026-11-25: 한 줄 메모는 꼭(사진은 있으면 같이 — 사진 자체는 서버에 오지 않는다)
      const memo = normalizeMemo(body.memo);
      if (!memo) return fail("오늘 한 걸 한 줄로 적어 주세요.", 400);
      const n = s.view.n;
      const action = planOf(c).days[n - 1].action; // 시작할 때 남긴 계획(엔진·타로) 또는 세 가지 마음
      const ins = await admin.from("challenge_checkins").insert({ challenge_id: c.id, user_id: a.userId, n, day_kst: today, method, memo, action });
      if (ins.error) {
        if (ins.error.code === "23505") return NextResponse.json({ ok: false, reason: "not_today", message: "오늘 인증 끝! 내일 또 만나요~", ...(await loadState(admin, a.userId, today)) }, { status: 409 });
        throw new Error(ins.error.code);
      }
      let firstReward = false;
      if (n >= CHALLENGE_DAYS) {
        await admin.from("challenges").update({ status: "done", ended_day: today, end_reason: "done" }).eq("id", c.id);
        // 계정당 한 번 — 이미 있으면 아무 일도 없다(동시에 두 번 와도 기본 키가 막음)
        const rw = await admin.from("challenge_rewards").upsert({ user_id: a.userId, challenge_id: c.id }, { onConflict: "user_id", ignoreDuplicates: true }).select("user_id");
        firstReward = !rw.error && (rw.data?.length ?? 0) > 0;
      }
      return NextResponse.json({ ok: true, n, memo, action, firstReward, ...(await loadState(admin, a.userId, today)) });
    }

    if (body?.op === "restart") {
      const c = s.current;
      if (!c || (s.view.kind !== "complete" && s.view.kind !== "expired")) return NextResponse.json({ ok: true, ...s });
      const expired = s.view.kind === "expired";
      const { error } = await admin
        .from("challenges")
        .update({ closed_at: new Date().toISOString(), status: expired ? "expired" : "done", ended_day: c.endedDay ?? today, end_reason: expired ? "expired" : "done" })
        .eq("id", c.id)
        .is("closed_at", null);
      if (error) throw new Error(error.code);
      return NextResponse.json({ ok: true, ...(await loadState(admin, a.userId, today)) });
    }

    return fail("알 수 없는 요청이에요.", 400);
  } catch (e) {
    console.error("챌린지 저장 실패:", (e as Error).message);
    return fail("지금은 저장하지 못했어요. 잠시 후 다시 해 주세요.");
  }
}
