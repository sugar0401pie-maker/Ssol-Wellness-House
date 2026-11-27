import { uiCopy } from "@/lib/engine";
import { slugFrom } from "@/lib/route";
import CalcScreen from "@/components/flow/CalcScreen";

const MIN_SECONDS = 6; // 계산 연출 최소 6초(설계 문서 2장)

export default async function CalcPage({ params }: { params: Promise<{ type: string }> }) {
  const { slug } = await slugFrom(params);
  const c = uiCopy().calc;
  return <CalcScreen slug={slug} copy={{ guide: c.guide, messages: c.messages, minSeconds: MIN_SECONDS }} />;
}
