import { NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/admin/server";

export const runtime = "nodejs";

// 암호 입력 표만 지운다(계정 로그아웃은 화면에서 Supabase로 따로 한다). 로그인 여부와 무관하게 언제든 호출 가능.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearAdminCookie(res);
  return res;
}
