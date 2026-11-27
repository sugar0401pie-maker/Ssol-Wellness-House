"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fill } from "@/lib/text";

type Copy = { message: string; messages: string[]; min_seconds: number; long_wait_seconds: number; long_wait: string };

// /{type}/loading?result=… — 결과 기다림(최소 3초, 30초가 넘으면 안내 한 줄). 끝나면 결과 1쪽.
export default function LoadingScreen({ resultId, nickname, copy }: { resultId: string; nickname: string; copy: Copy }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [long, setLong] = useState(false);

  useEffect(() => {
    const go = window.setTimeout(() => router.replace(`/result/${resultId}/1`), copy.min_seconds * 1000);
    const lw = window.setTimeout(() => setLong(true), copy.long_wait_seconds * 1000);
    const rot = window.setInterval(() => setI((x) => (x + 1) % copy.messages.length), 1500);
    return () => {
      window.clearTimeout(go);
      window.clearTimeout(lw);
      window.clearInterval(rot);
    };
  }, [router, resultId, copy]);

  return (
    <div className="pg center" style={{ paddingTop: 48 }}>
      <h2>{fill(copy.message, { nickname })}</h2>
      <div className="dots" aria-hidden>
        <i className="bg-목" />
        <i className="bg-화" />
        <i className="bg-토" />
        <i className="bg-금" />
        <i className="bg-수" />
      </div>
      <p key={i} className="fade sub">
        {fill(copy.messages[i] ?? "", { nickname })}
      </p>
      {long && <p className="hint">{fill(copy.long_wait, { nickname })}</p>}
    </div>
  );
}
