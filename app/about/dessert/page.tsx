import TestAboutPage, { testAboutMetadata } from "@/components/about/TestAboutPage";
import { TEST_PAGES } from "@/lib/about/testPages";

// 디저트 웰니스 유형 테스트 소개(원본: quiz.ssolwellnesshouse.com/about). 글은 lib/about/testPages.ts.
export const metadata = testAboutMetadata(TEST_PAGES.dessert);

export default function DessertAboutPage() {
  return <TestAboutPage page={TEST_PAGES.dessert} />;
}
