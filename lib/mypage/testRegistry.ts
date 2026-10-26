import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { loadQuizReportsList } from "./loadQuizReportsList";
import { loadAstroResultsList } from "./loadAstroResultsList";
import { astroResultUrl, ASTRO_SITE_URL } from "./astroResultUrl";
import { runTestProviders, type TestProvider } from "./testRunner";
import type { TestGroup } from "./testTypes";

// 마이페이지 "테스트 결과 열람하기"에 올라가는 테스트 종류들(위에서 아래 순서 = 화면 순서).
// **새 테스트가 생기면 여기에 항목 하나만 추가한다** — 화면(MyPageTab)은 이 목록을 그대로 그린다.
// 항목에 필요한 것: key(영문 고유값) · 제목 · 결과 없을 때 문구 · 테스트하러 가기 링크 ·
// load(사용자 결과를 최신순 TestResultItem[]로). 그 테스트의 결과 테이블이 다른 앱 소유(ssol_* 등)면
// 읽기만 하고 쓰지 않는다(CLAUDE.md 규칙).
type Ctx = { admin: ReturnType<typeof createAdminClient>; userId: string };

const TEST_PROVIDERS: TestProvider<Ctx>[] = [
  {
    key: "dessert",
    title: "디저트 심리테스트",
    emptyMessage: "아직 웰니스 유형 테스트 결과가 없어요. 심리 테스트를 먼저 진행해주시면, 완료 후 여기서 결과를 확인할 수 있어요.",
    start: { label: "지금 테스트하러 가기", href: "https://quiz.ssolwellnesshouse.com" },
    load: async ({ admin, userId }) =>
      (await loadQuizReportsList(admin, userId)).map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        title: `${r.dessertName} 유형`,
        badge: r.hasReport ? "심층보고서" : undefined,
        open: { label: "열기", href: `/report/${r.id}`, external: false },
        primary: { isPrimary: r.isPrimary },
      })),
  },
  {
    key: "astro",
    title: "점성술 테스트",
    emptyMessage: "아직 이 계정에 연결된 점성술 결과가 없어요. 로그인한 상태로 점성술 테스트를 마치면 여기에 나타나요.",
    start: { label: "점성술 테스트하러 가기", href: ASTRO_SITE_URL },
    // 조회 실패 시 loadAstroResultsList가 던지고, runTestProviders가 이 종류만 "불러오지 못함"으로 표시한다.
    load: async ({ admin, userId }) =>
      (await loadAstroResultsList(admin, userId)).map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        title: r.nickname ? `${r.nickname}님의 점성술 결과` : "점성술 결과",
        badge: r.paid ? "리포트" : undefined,
        open: { label: "자세히 보기", href: astroResultUrl(r.id, r.lastPage), external: true },
      })),
  },
];

export function loadTestGroups(admin: Ctx["admin"], userId: string): Promise<TestGroup[]> {
  return runTestProviders(TEST_PROVIDERS, { admin, userId });
}
