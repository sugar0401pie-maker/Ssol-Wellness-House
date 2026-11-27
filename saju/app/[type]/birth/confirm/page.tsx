import { uiCopy } from "@/lib/engine";
import { slugFrom } from "@/lib/route";
import BirthConfirm from "@/components/flow/BirthConfirm";

// 생년월일 확인 — 자기 주소가 있는 화면(모든 화면 개별 링크)
export default async function BirthConfirmPage({ params }: { params: Promise<{ type: string }> }) {
  const { slug } = await slugFrom(params);
  return <BirthConfirm slug={slug} copy={uiCopy().birth} />;
}
