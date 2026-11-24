import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { isInsightAction, isRootId } from "@/lib/interp/insights";
import { applyInsightAction, clearInsights, loadGrowthLines, loadInsights, loadInsightsWithLatest } from "@/lib/interp/insightsStore";
import { withUsageScope } from "@/lib/ai/usage";

// 마이페이지 "쏘웰라가 파악한 내용"(2026-10-18, 로드맵 10번). 본인 것만: 보기(GET) · 맞아요/아니에요/지우기(PATCH) · 전부 지우기(DELETE).
export const runtime = "nodejs";

async function authed(req: NextRequest): Promise<string | NextResponse> {
  if (!checkAccessCode(req.headers.get("x-access-code"))) return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  return userId ?? NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
}

async function handleGET(req: NextRequest) {
  const u = await authed(req);
  if (typeof u !== "string") return u;
  try {
    const admin = createAdminClient();
    // 2026-11-24: 마이페이지 맨 위 카드(latest — 최근 대화 기준 한 개) · "당신에 대한 해석" 화면(items — 쌓인 내용 최대 10개).
    const [{ items, latest }, growth] = await Promise.all([loadInsightsWithLatest(admin, u, 10), loadGrowthLines(admin, u).catch(() => [] as string[])]);
    return NextResponse.json({ items, latest, growth });
  } catch (e) {
    console.error("파악한 내용 조회 실패:", e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return NextResponse.json({ error: "불러오지 못했어요." }, { status: 500 });
  }
}

async function handlePATCH(req: NextRequest) {
  const u = await authed(req);
  if (typeof u !== "string") return u;
  const body = (await req.json().catch(() => null)) as { rootId?: unknown; action?: unknown } | null;
  if (!isRootId(body?.rootId) || !isInsightAction(body?.action)) return NextResponse.json({ error: "요청 값이 올바르지 않아요." }, { status: 400 });
  try {
    const admin = createAdminClient();
    if (!(await applyInsightAction(admin, u, body.rootId, body.action))) return NextResponse.json({ error: "찾을 수 없어요." }, { status: 404 });
    return NextResponse.json({ items: await loadInsights(admin, u, 10) });
  } catch (e) {
    console.error("파악한 내용 정정 실패:", e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return NextResponse.json({ error: "저장하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const u = await authed(req);
  if (typeof u !== "string") return u;
  try {
    await clearInsights(createAdminClient(), u);
    return NextResponse.json({ items: [], growth: [] });
  } catch (e) {
    console.error("파악한 내용 전체 삭제 실패:", e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return NextResponse.json({ error: "지우지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}

// AI 사용량 기록(ai_usage_log)에 이 요청의 기능 이름·사용자를 붙이려고 요청 전체를 사용량 범위로 감싼다(lib/ai/usage.ts).
export function GET(req: NextRequest) {
  return withUsageScope("mypage_insights", () => handleGET(req));
}
export function PATCH(req: NextRequest) {
  return withUsageScope("mypage_insights", () => handlePATCH(req));
}
