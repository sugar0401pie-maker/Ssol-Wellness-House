import "server-only";
import { notFound } from "next/navigation";
import { isTestSlug, testName, type TestSlug, type TestName } from "./tests";

// /{type}/… 주소의 type을 확인한다. love/career/money/total이 아니면 404.
export async function slugFrom(params: Promise<{ type: string }>): Promise<{ slug: TestSlug; name: TestName }> {
  const { type } = await params;
  if (!isTestSlug(type)) notFound();
  return { slug: type, name: testName(type) };
}
