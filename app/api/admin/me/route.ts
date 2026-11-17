import { NextResponse } from "next/server";
import { hasValidAdminCookie, requireAdmin } from "@/lib/admin/server";

export const runtime = "nodejs";

// 관리자 화면이 처음 열릴 때 부르는 확인. 자료는 주지 않고 "관리자인가 / 암호를 이미 입력했는가"만 알려 준다.
export async function GET(req: Request) {
  const gate = await requireAdmin(req, { password: false });
  if (!gate.ok) return gate.res;
  return NextResponse.json({
    ok: true,
    email: gate.admin.email,
    passwordVerified: hasValidAdminCookie(req, gate.admin.userId),
    passwordConfigured: !!process.env.ADMIN_PASSWORD,
  });
}
