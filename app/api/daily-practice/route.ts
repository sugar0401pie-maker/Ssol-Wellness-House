import { NextRequest, NextResponse } from "next/server";
import { getUserIdFast } from "@/lib/supabase/auth";
import { createTimer } from "@/lib/perf/serverTiming";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDailyPractice, preloadPractices } from "@/lib/rag/practicesSearch";
import { hasCrisisHistory } from "@/lib/safety/crisisHistory";
import { todayKeyKST } from "@/lib/safety/dailyLimit";
import { checkAccessCode } from "@/lib/security/accessCode";
import { getGreetingLine, holidayPracticeDomain } from "@/lib/home/greeting";
import { loadQuizPersona } from "@/lib/mypage/loadQuizPersona";
import { pickBySeed } from "@/lib/mypage/dessertTypeMap";
import { loadOnboardingPrefs } from "@/lib/onboarding/loadOnboardingPrefs";

// 홈 탭 전용: 인사말에 쓸 표시 이름 + 오늘의 실천방법 제안 하나를 준다. 채팅과 무관한 조회라
// 하루 대화 횟수 제한과도 무관하고, AI를 호출하지 않아 비용이 들지 않는다.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }

  // 2026-10-16(앱 첫 로딩 속도 개선): 읽기 전용 GET이라 토큰을 공개키로 직접 검증하고(getUserIdFast), 서로 필요하지 않은 조회는
  // 순서대로 하지 않고 동시에 한다. 이전에는 인증 → 프로필 → 온보딩 설정 → 위기 이력 → 실천 목록 → 적격성 표 → 유형(3단계)을
  // 차례로 기다려서 DB 왕복이 10번 가까이 쌓였다. 홈에는 유료 리포트 전문이 필요 없어 그 조회도 뺐다.
  const timer = createTimer();
  const userId = await getUserIdFast(req.headers.get("authorization"));
  timer.mark("auth");
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const admin = createAdminClient();
  const dateKey = todayKeyKST(); // "YYYY-MM-DD" (KST 기준 하루)
  // 명절 연휴엔 평소 개인화보다 "관계"(가족·지인) 쪽 제안을 우선한다.
  const holidayDomain = holidayPracticeDomain(dateKey);

  const [{ data: profile }, onboarding, crisis, persona] = await timer.time(
    "db",
    Promise.all([
      admin.from("profiles").select("display_name, nickname, enjoyment_category, concern_domain").eq("user_id", userId).maybeSingle(),
      loadOnboardingPrefs(admin, userId),
      // 이론 기반 실천 노출 제한: after_explore는 홈에 안 나가고, exposure는 위기 이력 계정에 안 나간다(lib/onboarding/servingRules.ts).
      hasCrisisHistory(admin, userId),
      // 홈 화면 캐릭터: 심리테스트 결과가 있으면 그 유형 캐릭터를, 없으면 사람마다 고정된 "랜덤" 캐릭터를 반투명으로 보여준다
      // (SAFE-005/014/015: 재미 요소일 뿐, 진단·성향 단정이 아니다).
      loadQuizPersona(admin, userId, { includeReport: false }),
      preloadPractices(), // 실천 목록·적격성 표(5분 캐시)도 같은 시간에 읽어 둔다
    ]).then(([p, o, c, q]) => [p, o, c, q] as const),
  );
  // 인사말엔 닉네임을 우선 쓰고, 닉네임을 안 정했으면 가입 때 적은 실명을 대신 쓴다.
  const greetingName = profile?.nickname ?? profile?.display_name ?? null;

  // 2026-09-25: 관계/육아/업무 적격성 하드 필터는 온보딩 여부와 무관하게 항상 먼저 적용된다
  // (getDailyPractice 내부) — 온보딩을 안 했거나 개인화 동의를 안 했으면 prefs가 전부 비어
  // 있어서, 파트너·육아 전제 제안은 자동으로 걸러지고 일반 제안만 남는다. 명절 "관계" 편향은
  // 개인화 동의를 한 사용자에게는 지금 적용되지 않는다 — 그 경우 Q4~Q7 취향 점수가 우선한다.
  const { prefs: onboardingPrefs, hasConsentedData } = onboarding;
  const practice = await timer.time(
    "practice",
    getDailyPractice(
      userId,
      dateKey,
      {
        category: holidayDomain ? null : profile?.enjoyment_category,
        domain: holidayDomain ?? profile?.concern_domain,
      },
      onboardingPrefs,
      hasConsentedData,
      { hasCrisisHistory: crisis },
    ),
  );

  const character = persona
    ? { code: persona.dessertCode, name: persona.name, tagline: persona.tagline, hasResult: true as const }
    : { code: pickBySeed(userId), name: null, tagline: null, hasResult: false as const };

  return NextResponse.json({
    displayName: greetingName,
    dateKey,
    greeting: getGreetingLine(dateKey, greetingName),
    practice,
    character,
  }, { headers: { "Server-Timing": timer.header() } });
}
