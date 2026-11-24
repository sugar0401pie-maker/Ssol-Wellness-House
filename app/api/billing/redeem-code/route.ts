import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { hashChatCode, normalizeChatCode, redeemMessage, type RedeemReason } from "@/lib/billing/chatCode";

// 채팅 이용 코드 등록(2026-11-24 대표님 요청 — /pricing의 "오프라인 웰니스 세션을 이용 중이신가요?" 안).
// 코드를 지문으로 바꿔 DB 함수 redeem_chat_access_code가 한 번에 확인·이용권 생성·사용 기록까지 한다(supabase/migrations/20261124000000).
// 쓰기 요청이라 로그인 확인은 엄격한 쪽(getUserIdFromAuthHeader). 코드 원문은 저장·기록하지 않는다.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const code = normalizeChatCode(body.code);
  if (!code) return NextResponse.json({ ok: false, reason: "invalid", message: redeemMessage("invalid") }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("redeem_chat_access_code", { p_user: userId, p_code_hash: hashChatCode(code) });
  if (error) {
    console.error("이용 코드 등록 실패:", error.code);
    return NextResponse.json({ ok: false, reason: "error", message: "지금은 코드를 등록하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
  const row = (Array.isArray(data) ? data[0] : data) as { ok: boolean; reason: RedeemReason; entitlement_expires_at: string | null } | null;
  const reason: RedeemReason = row?.reason ?? "not_found";
  return NextResponse.json(
    { ok: !!row?.ok, reason, message: redeemMessage(reason), expiresAt: row?.entitlement_expires_at ?? null },
    { status: row?.ok ? 200 : 400 },
  );
}
