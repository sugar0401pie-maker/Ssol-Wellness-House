import Link from "next/link";
import { notFound } from "next/navigation";
import { uiCopy } from "@/lib/engine";
import { isResultId } from "@/lib/store";

export const metadata = { robots: { index: false } };

// /checkout/{id}/fail?code=…&message=…&page=쪽 — 토스 결제창에서 취소·실패했을 때 돌아오는 곳(결제는 되지 않음).
export default async function CheckoutFail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; page?: string }>;
}) {
  const { id } = await params;
  if (!isResultId(id)) notFound();
  const sp = await searchParams;
  const page = Math.min(14, Math.max(4, Number(sp.page) || 4));
  const ck = uiCopy().checkout;
  return (
    <div className="pg">
      <h2>{ck.fail}</h2>
      {sp.message && <p className="sub">{String(sp.message).slice(0, 200)}</p>}
      <Link className="btn" href={`/checkout/${id}?page=${page}`} style={{ textAlign: "center", textDecoration: "none" }}>
        {ck.fail_button}
      </Link>
      <Link className="btn ghost" href={`/result/${id}/${page}`} style={{ textAlign: "center", textDecoration: "none" }}>
        ←
      </Link>
    </div>
  );
}
