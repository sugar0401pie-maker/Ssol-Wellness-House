"use client";

import { useEffect, useState } from "react";

const LINE = 24; // .rv li 줄 높이(px)

/**
 * 결제 상자 안 이용자 문장 세 줄 — 1.5초마다 한 줄씩 위로(ui_copy.reviews.rule).
 * 순서는 서버가 요청마다 섞어서 준다. 문장은 공개 문구(ui_copy.reviews)뿐 — 이용자 결과는 받지 않는다.
 */
export default function ReviewRotator({ lines }: { lines: string[] }) {
  const [i, setI] = useState(0);
  const steps = Math.max(1, lines.length - 2);
  useEffect(() => {
    if (steps <= 1) return;
    const t = setInterval(() => setI((x) => (x + 1) % steps), 1500);
    return () => clearInterval(t);
  }, [steps]);
  if (lines.length === 0) return null;
  return (
    <div className="rv">
      <div className="win">
        <ol style={{ transform: `translateY(-${i * LINE}px)` }}>
          {lines.map((t, k) => (
            <li key={k}>{t}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
