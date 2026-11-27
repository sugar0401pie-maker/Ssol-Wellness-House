// 사주 4종 — 주소에 쓰는 영어 이름(slug)과 엔진이 쓰는 한국어 이름(test_type)을 한곳에서 잇는다.
// 주소: saju.ssolwellnesshouse.com/{slug}/... (모든 화면에 개별 링크 — 2026-11-27 hard rule)

export const TEST_SLUGS = ["love", "career", "money", "total"] as const;
export type TestSlug = (typeof TEST_SLUGS)[number];
export type TestName = "연애운" | "직장운" | "재물운" | "종합사주";

const NAME_OF: Record<TestSlug, TestName> = {
  love: "연애운",
  career: "직장운",
  money: "재물운",
  total: "종합사주",
};

// 피드 그림 묶음(06_디자인/피드/manifest.json의 키)
export const FEED_GROUP: Record<TestSlug, string> = {
  love: "love",
  career: "career",
  money: "money",
  total: "general",
};

// 다른 테스트 배너(06_화면시안/배너)
export const BANNER_FILE: Record<TestSlug, string> = {
  love: "/banner/saju-ko-love.webp",
  career: "/banner/saju-ko-career.webp",
  money: "/banner/saju-ko-money.webp",
  total: "/banner/saju-ko-general.webp",
};

export function isTestSlug(v: string): v is TestSlug {
  return (TEST_SLUGS as readonly string[]).includes(v);
}

export function testName(slug: TestSlug): TestName {
  return NAME_OF[slug];
}

export function slugOf(name: string): TestSlug | null {
  const hit = (Object.entries(NAME_OF) as [TestSlug, TestName][]).find(([, n]) => n === name);
  return hit ? hit[0] : null;
}
