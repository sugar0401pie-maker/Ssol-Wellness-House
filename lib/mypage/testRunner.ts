import type { TestGroup, TestResultItem } from "./testTypes.ts";

// 테스트 종류 하나를 마이페이지에 올리는 방법. 새 테스트가 생기면 lib/mypage/testRegistry.ts의 목록에
// 이 모양의 항목 하나만 추가하면 된다(화면 코드는 건드리지 않는다).
export type TestProvider<Ctx> = {
  key: string;
  title: string;
  emptyMessage: string;
  start: { label: string; href: string };
  // 이 사용자의 결과 목록(최신순)을 돌려준다. 던져도 된다 — 그 종류만 "불러오지 못함"으로 표시된다.
  load: (ctx: Ctx) => Promise<TestResultItem[]>;
};

// 모든 테스트 종류를 동시에 불러온다. 한 종류가 실패해도 나머지는 그대로 보이게 종류별로 격리하고,
// 에러는 버리지 않고 남긴다(2026-09-25 교훈). 결과 그룹의 순서는 등록한 순서 그대로다.
export async function runTestProviders<Ctx>(providers: TestProvider<Ctx>[], ctx: Ctx): Promise<TestGroup[]> {
  const seen = new Set<string>();
  for (const p of providers) {
    if (seen.has(p.key)) throw new Error(`테스트 종류 key가 중복됐어요: ${p.key}`);
    seen.add(p.key);
  }
  return Promise.all(
    providers.map(async (p): Promise<TestGroup> => {
      let items: TestResultItem[] | null;
      try {
        items = await p.load(ctx);
      } catch (e) {
        console.error(`테스트 결과 목록 조회 실패(${p.key}):`, e instanceof Error ? e.message : e);
        items = null;
      }
      return { key: p.key, title: p.title, items, emptyMessage: p.emptyMessage, start: p.start };
    }),
  );
}
