import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { PROFILE_RESET, WITHDRAW_DELETE_TABLES } from "@/lib/account/withdrawPlan";

// 회원 탈퇴(2026-11-19 대표님 결정: 쏘웰라 정보만 삭제 — 같은 계정의 테스트·타로 결과와 결제 기록은 남김). 무엇을 지우는지는 lib/account/withdrawPlan.ts.
// 본인만(로그인 토큰의 사용자) 지울 수 있다. 한 단계라도 실패하면 500 — 화면은 "탈퇴되었습니다"를 보여 주지 않는다(지운 줄 알고 떠나지 않게).
// 로그에는 사용자 id·내용을 남기지 않고 실패한 표 이름과 오류 코드만 남긴다(CLAUDE.md §8).
export const runtime = "nodejs";
const MISSING_TABLE = new Set(["42P01", "PGRST205"]); // 표가 없음(Postgres · PostgREST 스키마 캐시)

export async function POST(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const admin = createAdminClient();
  const fail = (step: string, code?: string) => {
    console.error("탈퇴 처리 실패:", step, code ?? "");
    return NextResponse.json({ error: "탈퇴 처리 중 문제가 생겼어요. 잠시 후 다시 시도하거나 고객센터로 알려 주세요." }, { status: 500 });
  };

  // 해석 기록(근거 장부·뿌리 상태·카드·고민 상태·연습·휴먼 세션 기록) — CSO 함수가 한 번에 지운다.
  const { error: pe } = await admin.rpc("sw_purge_user", { p_user: userId, p_include_human: true });
  if (pe) return fail("sw_purge_user", pe.code);
  for (const table of WITHDRAW_DELETE_TABLES) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    // 아직 만들지 않은 표(마이그레이션 전)는 지울 기록도 없으니 건너뛴다 — 그 밖의 실패는 그대로 멈춘다.
    if (error && !MISSING_TABLE.has(error.code ?? "")) return fail(table, error.code);
  }
  const { error: re } = await admin.from("profiles").update({ ...PROFILE_RESET, updated_at: new Date().toISOString() }).eq("user_id", userId);
  if (re) return fail("profiles", re.code);
  return NextResponse.json({ ok: true });
}
