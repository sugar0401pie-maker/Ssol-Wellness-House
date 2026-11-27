import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ResultPage from "@/components/result/ResultPage";
import { SAL_ROUTE_KEYS } from "@/lib/resultView";
import { getResult, isResultId } from "@/lib/store";
import { uiCopy } from "@/components/result/copy";
import { testName } from "@/lib/tests";

// 대표 살 1 · 2 · 3위 각자의 주소(/result/{id}/sal/{1|2|3}) — 쪽 p4 · sal2 · sal3과 같은 화면.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SalRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; n: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id, n } = await params;
  const sp = await searchParams;
  const key = SAL_ROUTE_KEYS[Number(n) - 1];
  if (!/^[123]$/.test(n) || !key || !isResultId(id)) notFound();
  const r = await getResult(id);
  if (!r) notFound();
  const order: string[] = uiCopy().layout?.order_by_test?.[testName(r.slug)] ?? [];
  const pageNo = order.indexOf(key) + 1;
  if (pageNo < 1) notFound();
  return <ResultPage id={id} n={pageNo} opened={sp.opened === "1"} />;
}
