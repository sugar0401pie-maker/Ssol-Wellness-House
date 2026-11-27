"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { readHistory, type HistoryItem } from "@/components/flow/draft";

// 이 브라우저에서 본 결과 목록(결과 번호만 저장). 로그인하면 계정에 저장되는 목록은 로그인 연결 때 더한다.
export default function HistoryList({ titles, empty }: { titles: Record<string, string>; empty: string }) {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setItems(readHistory()), []);
  if (!items) return null;
  if (!items.length) return <p className="sub">{empty}</p>;
  return (
    <>
      {items.map((x) => (
        <Link key={x.id} className="box" href={`/result/${x.id}/1`} style={{ display: "block", textDecoration: "none" }}>
          <b>{titles[x.slug]}</b>
          <div className="sub">{new Date(x.at).toLocaleDateString("ko-KR")}</div>
        </Link>
      ))}
    </>
  );
}
