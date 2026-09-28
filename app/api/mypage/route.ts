import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";

// 마이페이지 전용: "내 정보"를 준다. "내 유형"(응시 기록 목록·심층보고서)은 2026-09-27부터
// 여러 응시 기록을 다룰 수 있도록 /api/mypage/reports(목록)와 /api/mypage/reports/[resultId]
// (상세)로 분리했다 — 이 endpoint는 더 이상 persona/report를 돌려주지 않는다.
// 2026-09-22 결정: 로그인 계정을 기존 웰니스 유형 테스트/결제 사이트와 공유하므로,
// 그 사이트의 결과(ssol_profiles)를 "읽기 전용"으로만 조회한다.
// CLAUDE.md 규칙: ssol_* 테이블은 절대 쓰기/수정하지 않는다.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }

  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const admin = createAdminClient();

  const [{ data: authUser }, { data: profile }, { data: ssolProfile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin
      .from("profiles")
      .select("display_name, nickname, birth_date, phone, address, marketing_consent")
      .eq("user_id", userId)
      .maybeSingle(),
    admin.from("ssol_profiles").select("name, gender").eq("id", userId).maybeSingle(),
  ]);

  return NextResponse.json({
    displayName: profile?.display_name ?? ssolProfile?.name ?? null,
    nickname: profile?.nickname ?? null,
    birthDate: profile?.birth_date ?? null,
    phone: profile?.phone ?? null,
    address: profile?.address ?? null,
    marketingConsent: profile?.marketing_consent ?? false,
    email: authUser?.user?.email ?? null,
    gender: ssolProfile?.gender ?? null,
    // 2026-09-28: 카카오/네이버로 가입한 사용자는 비밀번호 자체가 없어서 "내 정보 수정" 전
    // 비밀번호 재확인 단계를 통과할 수 없었다(버그 발견) — 이메일 provider가 연결돼 있어야만
    // 비밀번호가 존재하므로, 그 여부를 내려줘서 프런트가 재확인 단계를 건너뛸지 정한다.
    hasPassword: authUser?.user?.app_metadata?.providers?.includes("email") ?? true,
  });
}
