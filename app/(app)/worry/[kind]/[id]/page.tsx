import { notFound } from "next/navigation";
import BoardReader from "@/components/board/BoardReader";
import AppTagResults from "@/components/board/AppTagResults";

export const metadata = { title: "고민 타파 | 쏠 웰니스 하우스" };

// 글 읽기: /worry/guide/<slug> · /worry/post/<회차>. 하단 메뉴 없음.
export default async function Read({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (kind === "tag") return <AppTagResults tag={decodeURIComponent(id)} />;
  if (kind !== "guide" && kind !== "post") notFound();
  return <BoardReader kind={kind} id={id} />;
}
