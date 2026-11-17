import { NextResponse } from "next/server";
import { passwordMatches } from "@/lib/admin/token";
import { clientIp, isLockedOut, logAdminAction, rememberFailure, requireAdmin, setAdminCookie } from "@/lib/admin/server";

export const runtime = "nodejs";

// 관리자 암호 확인. 관리자 계정(카카오)으로 로그인한 상태에서만 부를 수 있고, 맞으면 30분짜리 표(쿠키)를 준다. 5번 틀리면 15분 잠긴다.
export async function POST(req: Request) {
  const gate = await requireAdmin(req, { password: false });
  if (!gate.ok) return gate.res;
  if (!process.env.ADMIN_PASSWORD) return NextResponse.json({ error: "관리자 암호가 서버에 설정되지 않았어요(ADMIN_PASSWORD)." }, { status: 503 });
  if (await isLockedOut(gate.admin)) return NextResponse.json({ error: "암호를 여러 번 틀려서 15분 동안 잠겼어요. 잠시 뒤에 다시 시도해 주세요." }, { status: 429 });

  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }

  const ip = clientIp(req);
  if (!passwordMatches(password, process.env.ADMIN_PASSWORD)) {
    rememberFailure(gate.admin);
    await logAdminAction(gate.admin, "login_fail", { ip });
    return NextResponse.json({ error: "암호가 맞지 않아요." }, { status: 401 });
  }
  await logAdminAction(gate.admin, "login_ok", { ip });
  const res = NextResponse.json({ ok: true });
  setAdminCookie(res, gate.admin.userId);
  return res;
}
