import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ResultPage from "@/components/result/ResultPage";
import { parsePageNo } from "@/lib/resultView";

// 결과 N쪽(/result/{id}/{N}). 결제하고 돌아온 상태는 ?opened=1.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; page: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id, page } = await params;
  const sp = await searchParams;
  const n = parsePageNo(page);
  if (n === null) notFound();
  return <ResultPage id={id} n={n} opened={sp.opened === "1"} />;
}
