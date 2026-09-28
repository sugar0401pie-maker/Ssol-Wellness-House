import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";

// 마이페이지 "내 정보 확인"에서 이름(실명)·닉네임·생년월일·휴대전화번호·주소·마케팅 동의를
// 바꿀 때 쓴다. 이메일은 여기서 다루지 않는다 — 재인증(OTP)이 필요해 브라우저에서 Supabase
// Auth를 직접 호출한다(lib/supabase/authClient.ts의 requestEmailChange/verifyEmailChange,
// 가입 때와 같은 패턴). 2026-09-25: 휴대전화번호/주소/마케팅 동의 추가(migration 20260925000700).
export const runtime = "nodejs";

const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 2026-09-28 신설: 카카오/네이버로 가입한 사람은 이메일 회원가입과 달리 이름·생년월일을 직접
// 입력받는 절차가 없어서 profiles에 그 정보가 아예 비어 있다(버그로 발견 — 홈 인사말에
// 닉네임이 안 나오는 문제도 같은 원인). AppFrame이 로그인 직후 이 값을 확인해서, OAuth로
// 가입했는데 아직 채워지지 않았으면 OAuthProfileGate(회원가입 화면과 비슷한 추가 정보 입력
// 화면)를 띄운다. 이메일 가입자는 finishSignup()이 이미 다 채워놔서 여기 걸리지 않는다.
export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: profile }, { data: authUser }] = await Promise.all([
    admin.from("profiles").select("display_name, nickname, birth_date").eq("user_id", userId).maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);

  const isOAuthOnly = !(authUser?.user?.app_metadata?.providers as string[] | undefined)?.includes("email");
  const needsCompletion = isOAuthOnly && (!profile?.display_name || !profile?.birth_date);
  // 카카오는 실명/닉네임 후보를 user_metadata.name(또는 full_name)으로 이미 갖고 있어서,
  // 새로 입력받는 이름 칸에 미리 채워둘 수 있다 — 매번 다시 타이핑하지 않아도 되게.
  const meta = authUser?.user?.user_metadata as Record<string, unknown> | undefined;
  const suggestedName =
    (typeof meta?.name === "string" && meta.name) || (typeof meta?.full_name === "string" && meta.full_name) || null;

  return NextResponse.json({
    needsCompletion,
    displayName: profile?.display_name ?? null,
    nickname: profile?.nickname ?? null,
    birthDate: profile?.birth_date ?? null,
    suggestedName,
  });
}

export async function PATCH(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let body: {
    displayName?: unknown;
    nickname?: unknown;
    birthDate?: unknown;
    phone?: unknown;
    address?: unknown;
    marketingConsent?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const update: Record<string, string | boolean | null> = {};

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

  if (body.phone !== undefined) {
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 20) : "";
    update.phone = phone || null;
  }

  if (body.address !== undefined) {
    const address = typeof body.address === "string" ? body.address.trim().slice(0, 300) : "";
    update.address = address || null;
  }

  if (body.marketingConsent !== undefined) {
    const consent = body.marketingConsent === true;
    update.marketing_consent = consent;
    update.marketing_consent_at = consent ? new Date().toISOString() : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "바꿀 내용이 없습니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update(update).eq("user_id", userId);
  if (error) return NextResponse.json({ error: "저장에 실패했어요." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
