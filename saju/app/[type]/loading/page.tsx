import { notFound } from "next/navigation";
import { uiCopy } from "@/lib/engine";
import { slugFrom } from "@/lib/route";
import { getResult, isResultId } from "@/lib/store";
import LoadingScreen from "@/components/flow/LoadingScreen";

export default async function LoadingPage({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<{ result?: string }> }) {
  const { slug } = await slugFrom(params);
  const { result } = await searchParams;
  const r = result && isResultId(result) ? await getResult(result) : null;
  if (!r || r.slug !== slug) notFound();
  return <LoadingScreen resultId={r.id} nickname={r.nickname} copy={uiCopy().loading} />;
}
