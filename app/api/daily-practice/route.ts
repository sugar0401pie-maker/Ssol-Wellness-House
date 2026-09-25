import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDailyPractice } from "@/lib/rag/practicesSearch";
import { todayKeyKST } from "@/lib/safety/dailyLimit";
import { checkAccessCode } from "@/lib/security/accessCode";
import { getGreetingLine, holidayPracticeDomain } from "@/lib/home/greeting";
import { loadQuizPersona } from "@/lib/mypage/loadQuizPersona";
import { pickBySeed } from "@/lib/mypage/dessertTypeMap";

// 홈 탭 전용: 인사말에 쓸 표시 이름 + 오늘의 실천방법 제안 하나를 준다. 채팅과 무관한 조회라
// 하루 대화 횟수 제한과도 무관하고, AI를 호출하지 않아 비용이 들지 않는다.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }

  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, enjoyment_category, concern_domain")
    .eq("user_id", userId)
    .maybeSingle();

  const dateKey = todayKeyKST(); // "YYYY-MM-DD" (KST 기준 하루)
  // 명절 연휴엔 평소 개인화보다 "관계"(가족·지인) 쪽 제안을 우선한다.
  const holidayDomain = holidayPracticeDomain(dateKey);
  const practice = await getDailyPractice(userId, dateKey, {
    category: holidayDomain ? null : profile?.enjoyment_category,
    domain: holidayDomain ?? profile?.concern_domain,
  });

  // 홈 화면 캐릭터: 심리테스트 결과가 있으면 그 유형 캐릭터를, 없으면 사람마다 고정된
  // "랜덤" 캐릭터를 반투명으로 보여준다(SAFE-005/014/015: 재미 요소일 뿐, 진단·성향 단정이 아니다).
  const persona = await loadQuizPersona(admin, userId);
  const character = persona
    ? { code: persona.dessertCode, name: persona.name, hasResult: true as const }
    : { code: pickBySeed(userId), name: null, hasResult: false as const };

  return NextResponse.json({
    displayName: profile?.display_name ?? null,
    dateKey,
    greeting: getGreetingLine(dateKey, profile?.display_name ?? null),
    practice,
    character,
  });
}
