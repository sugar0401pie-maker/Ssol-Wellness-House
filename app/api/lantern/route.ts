import { NextRequest, NextResponse } from "next/server";
import { getUserIdFast, getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { todayKeyKST } from "@/lib/safety/dailyLimit";
import { screenExplicit } from "@/lib/safety/explicit";
import { loadGreetingName } from "@/lib/profile/greetingName";
import { isLanternOpen, lanternEventKey, lanternPeriod, normalizeWish } from "@/lib/lantern/config";

// 풍등 날리기(홈 화면 개편 요청문 v1.9.4 2장, 2026-11-25). 이벤트 기간(새해까지)에 한 번만 날린다(대표님 2026-11-25 — 처음엔 하루 한 번).
// GET: 이벤트 중인지·이미 날렸는지(날린 시각 — 화면이 "지금 몇 km 상공" 계산에 씀)·인사 이름 · POST: 소원 저장(서버 날짜만 믿는다).
// 소원 글은 계정에 연결해 저장하고 다른 이용자에게 보이지 않는다(sky_lantern_wishes). 이용권은 필요 없다.
// 소원에 위기·폭력의 직접 표현이 있으면 저장은 그대로 하고 끝 화면에 '도움받을 곳' 링크를 함께 보여 준다(채팅 안전 경로와 같은 판단 lib/safety/explicit.ts).
export const runtime = "nodejs";

function status() {
  const today = todayKeyKST();
  const period = lanternPeriod(process.env as { SW_LANTERN_START?: string; SW_LANTERN_END?: string });
  return { today, period, open: isLanternOpen(today, period), eventKey: lanternEventKey(period) };
}

export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  const userId = await getUserIdFast(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const s = status();
  const admin = createAdminClient();
  const [row, name] = await Promise.all([
    admin.from("sky_lantern_wishes").select("created_at").eq("user_id", userId).eq("event_key", s.eventKey).maybeSingle(),
    loadGreetingName(admin, userId).catch(() => null),
  ]);
  if (row.error) console.warn("풍등 기록 조회 실패:", row.error.code); // 표가 없으면(마이그레이션 전) 안 날린 것으로 본다
  const flownAt = (row.data as { created_at?: string } | null)?.created_at ?? null;
  return NextResponse.json({ open: s.open, flown: !!flownAt, flownAt, name, period: s.period });
}

export async function POST(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { wish?: unknown } | null;
  const wish = normalizeWish(body?.wish);
  if (!wish) return NextResponse.json({ ok: false, reason: "invalid", message: "소원을 40자 안에서 한 줄로 적어 주세요." }, { status: 400 });
  const s = status();
  if (!s.open) return NextResponse.json({ ok: false, reason: "closed", message: "지금은 풍등 날리기 기간이 아니에요." }, { status: 403 });
  const ex = screenExplicit(wish);
  const helpHint = ex.level === "urgent" || ex.violence !== null;
  const { data, error } = await createAdminClient()
    .from("sky_lantern_wishes")
    .insert({ user_id: userId, event_key: s.eventKey, day_kst: s.today, wish, help_hint: helpHint })
    .select("created_at")
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ ok: false, reason: "already", message: "풍등은 새해까지 한 번 날릴 수 있어요." }, { status: 409 });
    console.error("풍등 소원 저장 실패:", error.code);
    return NextResponse.json({ ok: false, reason: "error", message: "풍등이 잠시 구름에 걸렸어요. 잠시 후 다시 날려 볼까요?" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, help: helpHint, flownAt: (data as { created_at: string }).created_at });
}
