import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/server";
import { loadDashboard } from "@/lib/admin/data";

export const runtime = "nodejs";
export const maxDuration = 60;

// 대시보드 숫자(가입자·사용자·결제·경고). 개인 대화 원문은 들어 있지 않다(건수와 계정 이메일 정도).
export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  try {
    return NextResponse.json(await loadDashboard(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/stats]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "대시보드를 불러오지 못했어요." }, { status: 500 });
  }
}
