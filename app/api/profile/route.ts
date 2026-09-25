import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";

// 마이페이지 "내 정보 확인"에서 이름(실명)·닉네임·생년월일을 바꿀 때 쓴다. 이메일은 여기서
// 다루지 않는다 — 재인증(OTP)이 필요해 브라우저에서 Supabase Auth를 직접 호출한다
// (lib/supabase/authClient.ts의 requestEmailChange/verifyEmailChange, 가입 때와 같은 패턴).
export const runtime = "nodejs";

const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let body: { displayName?: unknown; nickname?: unknown; birthDate?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const update: Record<string, string | null> = {};

  if (body.displayName !== undefined) {
    const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 50) : "";
    if (!displayName) return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
    update.display_name = displayName;
  }

  if (body.nickname !== undefined) {
    // 닉네임은 실명과 달리 비워둘 수 있다(비우면 실명이 대신 표시됨).
    const nickname = typeof body.nickname === "string" ? body.nickname.trim().slice(0, 50) : "";
    update.nickname = nickname || null;
  }

  if (body.birthDate !== undefined) {
    const birthDate = typeof body.birthDate === "string" ? body.birthDate : "";
    if (!BIRTH_DATE_RE.test(birthDate)) {
      return NextResponse.json({ error: "생년월일 형식이 올바르지 않습니다." }, { status: 400 });
    }
    update.birth_date = birthDate;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "바꿀 내용이 없습니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update(update).eq("user_id", userId);
  if (error) return NextResponse.json({ error: "저장에 실패했어요." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
