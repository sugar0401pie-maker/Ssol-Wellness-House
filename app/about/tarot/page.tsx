import TestAboutPage, { testAboutMetadata } from "@/components/about/TestAboutPage";
import { TEST_PAGES } from "@/lib/about/testPages";

// 쏠 타로 하우스 소개(원본: tarot.ssolwellnesshouse.com/about). 글은 lib/about/testPages.ts.
export const metadata = testAboutMetadata(TEST_PAGES.tarot);

export default function TarotAboutPage() {
  return <TestAboutPage page={TEST_PAGES.tarot} />;
}
