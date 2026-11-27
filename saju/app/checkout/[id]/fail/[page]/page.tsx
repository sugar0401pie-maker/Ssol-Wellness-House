import Link from "next/link";
import { notFound } from "next/navigation";
import { uiCopy } from "@/lib/engine";
import { isResultId } from "@/lib/store";

export const metadata = { robots: { index: false } };

// /checkout/{id}/fail/{쪽} — 카카오페이 결제창에서 취소하거나 실패했을 때 돌아오는 곳(결제는 되지 않음).
export default async function KakaoPayFail({ params }: { params: Promise<{ id: string; page: string }> }) {
  const { id, page: pageStr } = await params;
  if (!isResultId(id)) notFound();
  const page = Math.min(14, Math.max(4, Number(pageStr) || 4));
  const ck = uiCopy().checkout;
  return (
    <div className="pg">
      <h2>{ck.fail}</h2>
      <Link className="btn" href={`/checkout/${id}?page=${page}`} style={{ textAlign: "center", textDecoration: "none" }}>
        {ck.fail_button}
      </Link>
      <Link className="btn ghost" href={`/result/${id}/${page}`} style={{ textAlign: "center", textDecoration: "none" }}>
        ←
      </Link>
    </div>
  );
}
