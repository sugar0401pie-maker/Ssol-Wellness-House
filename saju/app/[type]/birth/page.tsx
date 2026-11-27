import { uiCopy } from "@/lib/engine";
import { slugFrom } from "@/lib/route";
import { REGIONS } from "@/lib/regions";
import BirthForm from "@/components/flow/BirthForm";

export default async function BirthPage({ params }: { params: Promise<{ type: string }> }) {
  const { slug } = await slugFrom(params);
  return <BirthForm slug={slug} copy={uiCopy().birth} regions={REGIONS.map((r) => r.name)} />;
}
