"use client";

import { useEffect, useState } from "react";

// 고민 예시 목록. 서버는 전체를 글자로 내려보내고(검색엔진·자바스크립트 없는 화면),
// 브라우저에서 shown개만 무작위로 남긴다(목록 순서는 그대로). 메인 about.html과 같은 방식.
export default function ConcernList({ items, shown }: { items: [string, string][]; shown: number }) {
  const [picked, setPicked] = useState<Set<number> | null>(null);

  useEffect(() => {
    const order = items.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    // 무작위 값은 서버와 브라우저가 다르므로, 화면이 붙은 뒤에만 고를 수 있다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPicked(new Set(order.slice(0, shown)));
  }, [items, shown]);

  return (
    <ul className="mt-3 space-y-1.5 text-[14px] leading-6 text-slate-600">
      {items.map(([area, quote], i) => (
        <li key={quote} hidden={picked !== null && !picked.has(i)}>
          <span className="font-medium text-foreground">{area}</span> “{quote}”
        </li>
      ))}
    </ul>
  );
}
