import { NextRequest, NextResponse } from "next/server";
import { checkAccessCode } from "@/lib/security/accessCode";

// 화면에 "코드가 맞다/틀리다"를 바로 알려주기 위한 확인용 엔드포인트.
// 실제 보호는 이 엔드포인트가 아니라 /api/chat, /api/memory가 매 요청마다 직접 검사해서 한다.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code : null;
  return NextResponse.json({ ok: checkAccessCode(code) });
}
