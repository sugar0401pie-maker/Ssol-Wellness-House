import TestAboutPage, { testAboutMetadata } from "@/components/about/TestAboutPage";
import { TEST_PAGES } from "@/lib/about/testPages";

// 쏠 아스트로 하우스 소개(원본: astro.ssolwellnesshouse.com/about). 글은 lib/about/testPages.ts.
export const metadata = testAboutMetadata(TEST_PAGES.astro);

export default function AstroAboutPage() {
  return <TestAboutPage page={TEST_PAGES.astro} />;
}
