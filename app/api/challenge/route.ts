import { NextRequest, NextResponse } from "next/server";
import { getUserIdFast, getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { todayKeyKST } from "@/lib/safety/dailyLimit";
import { CHALLENGE_DAYS, METHODS, deriveView, keepInHistory, normalizeMemo, startDayFor, type Challenge, type Checkin, type Method } from "@/lib/challenge/state";
import { DEFAULT_THEME, isThemeKey, themeOf } from "@/lib/challenge/themes";
import { isLanternOpen, lanternPeriod } from "@/lib/lantern/config";

// 작심삼일 챌린지(갓생러모임, 요청문 v1.9.4 3·9·13장). 날짜는 서버의 한국 날짜만 믿는다(기기 시계 무시).
// GET: 지금 챌린지·기록·리워드를 받았는지 · POST {op}: start(시작) · checkin(오늘 저장 — 메모·행동·방식, 사진은 서버에 안 올림) · restart(또심삼일·다시 시작 → 기록으로).
// 리워드: 처음 3번을 채운 순간 challenge_rewards에 계정당 한 줄(기본 키) — 내용은 정해지기 전이라 기록만 남긴다(13-8장).
export const runtime = "nodejs";

type Admin = ReturnType<typeof createAdminClient>;
type Row = { id: string; seq: number; theme: string; started_day: string; status: Challenge["status"]; ended_day: string | null; end_reason: string | null; closed_at: string | null };
type CkRow = { challenge_id: string; n: number; day_kst: string; method: Method; memo: string | null; action: string };

const toChallenge = (r: Row, cks: CkRow[]): Challenge => ({
  id: r.id, seq: r.seq, theme: r.theme, startedDay: r.started_day, status: r.status, endedDay: r.ended_day, endReason: r.end_reason,
  checkins: cks.filter((c) => c.challenge_id === r.id).sort((a, b) => a.n - b.n).map((c): Checkin => ({ n: c.n, day: c.day_kst, method: c.method, memo: c.memo, action: c.action })),
});

async function loadState(admin: Admin, userId: string, today: string) {
  const [chs, cks, rw] = await Promise.all([
    admin.from("challenges").select("id,seq,theme,started_day,status,ended_day,end_reason,closed_at").eq("user_id", userId).order("seq", { ascending: false }).limit(20),
    admin.from("challenge_checkins").select("challenge_id,n,day_kst,method,memo,action").eq("user_id", userId).order("day_kst", { ascending: false }).limit(80),
    admin.from("challenge_rewards").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (chs.error || cks.error) throw new Error(chs.error?.code ?? cks.error?.code ?? "load");
  const rows = (chs.data ?? []) as Row[];
  const ckRows = (cks.data ?? []) as CkRow[];
  const openRow = rows.find((r) => !r.closed_at) ?? null;
  const current = openRow ? toChallenge(openRow, ckRows) : null;
  const history = rows.filter((r) => r.closed_at).map((r) => toChallenge(r, ckRows)).filter(keepInHistory);
  const rewarded = !rw.error && !!rw.data;
  const checkedInToday = ckRows.some((c) => c.day_kst === today);
  // 이벤트 기간(풍등과 같은 기간 — 요청문 0장 4번): 홈 배너 ②는 이 기간에만 보인다. 챌린지 자체는 기간과 상관없이 할 수 있다.
  const eventOpen = isLanternOpen(today, lanternPeriod(process.env as { SW_LANTERN_START?: string; SW_LANTERN_END?: string }));
  return { today, current, history, rewarded, checkedInToday, eventOpen, view: deriveView(current, today, rewarded) };
}

async function auth(req: NextRequest, fast: boolean) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) return { error: NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 }) };
  const h = req.headers.get("authorization");
  const userId = fast ? await getUserIdFast(h) : await getUserIdFromAuthHeader(h);
  if (!userId) return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  return { userId };
}

const fail = (message: string, status = 500) => NextResponse.json({ ok: false, message }, { status });

export async function GET(req: NextRequest) {
  const a = await auth(req, true);
  if ("error" in a) return a.error;
  try {
    const s = await loadState(createAdminClient(), a.userId, todayKeyKST());
    return NextResponse.json({ ok: true, ...s });
  } catch (e) {
    console.error("챌린지 불러오기 실패:", (e as Error).message);
    return fail("챌린지를 불러오지 못했어요. 잠시 후 다시 열어 주세요.");
  }
}

export async function POST(req: NextRequest) {
  const a = await auth(req, false);
  if ("error" in a) return a.error;
  const body = (await req.json().catch(() => null)) as { op?: string; theme?: unknown; method?: unknown; memo?: unknown } | null;
  const admin = createAdminClient();
  const today = todayKeyKST();
  try {
    const s = await loadState(admin, a.userId, today);

    if (body?.op === "start") {
      if (s.current) return NextResponse.json({ ok: true, ...s }); // 이미 있으면 그대로(두 번 눌러도 하나)
      const top = await admin.from("challenges").select("seq").eq("user_id", a.userId).order("seq", { ascending: false }).limit(1);
      const seq = (((top.data ?? [])[0] as { seq?: number } | undefined)?.seq ?? 0) + 1;
      const theme = isThemeKey(body.theme) ? body.theme : DEFAULT_THEME;
      const { error } = await admin.from("challenges").insert({ user_id: a.userId, seq, theme, started_day: startDayFor(today, s.checkedInToday) });
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
      const action = themeOf(c.theme).days[n - 1].action;
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
