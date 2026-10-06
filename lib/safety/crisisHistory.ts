import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

// "위기 이력" 정의(2026-10-06 owner 승인): 이 계정의 어떤 대화(사용자가 삭제한 대화 포함)라도 안전 상태가
// 'crisis'로 올라간 적이 있으면 위기 이력이 있다. chat_sessions.safety_flag는 올라가기만 하고 내려가지 않으며
// (app/api/chat/route.ts), 사용자의 대화 삭제는 deleted_at만 채우는 소프트 삭제라 기록이 남는다 — 그래서 deleted_at은 보지 않는다.
// 계정을 탈퇴해 대화 기록이 지워지면 이력도 함께 사라진다(개인정보 삭제 원칙).
//
// 용도: 위기 이력 계정에는 exposure 실천(평소 피하던 감정에 다가가는 연습)을 전부 제외한다(lib/onboarding/servingRules.ts).
// 조회가 실패하면 "이력 있음"으로 본다 — 알 수 없을 때는 더 조심스러운 쪽(CLAUDE.md fail-safe).
export async function hasCrisisHistory(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("chat_sessions")
    .select("session_id")
    .eq("user_id", userId)
    .eq("safety_flag", "crisis")
    .limit(1);
  if (error) {
    console.error("위기 이력 조회 실패(이력 있음으로 간주):", error.message);
    return true;
  }
  return (data ?? []).length > 0;
}
