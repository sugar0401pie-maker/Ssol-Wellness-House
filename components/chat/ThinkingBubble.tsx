"use client";

import { useEffect, useState } from "react";
import { THINKING_INTERVAL_MS, THINKING_WORDS, thinkingWordAt } from "@/lib/chat/thinkingWords";

// "생각하는 중…" 대신 점 3개가 순서대로 튀어오르는 타이핑 인디케이터 (2026-09-22 결정:
// 글자가 가만히 있지 않고 움직이게 해달라는 요청 반영).
// 2026-10-15 owner 요청: 문구도 깜빡이며 움직이고, "생각하는 중" 말고 다른 문구도 3초마다 돌아가며 나온다
// (lib/chat/thinkingWords.ts). 새 답변을 기다릴 때마다 이 말풍선이 새로 그려지므로 항상 첫 문구부터 시작한다.
export default function ThinkingBubble() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), THINKING_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl bg-navy-soft px-4 py-2.5 text-[15px] leading-6 text-foreground">
        {/* key가 바뀌면 문구가 새로 그려져 부드럽게 나타나고(ssol-word-in), 그 안에서 계속 깜빡인다(ssol-pulse-text). */}
        <span key={tick % THINKING_WORDS.length} className="ssol-word-in">
          <span className="ssol-pulse-text">{thinkingWordAt(tick)}</span>
        </span>
        <span className="ssol-thinking-dot" style={{ animationDelay: "0ms" }}>
          .
        </span>
        <span className="ssol-thinking-dot" style={{ animationDelay: "150ms" }}>
          .
        </span>
        <span className="ssol-thinking-dot" style={{ animationDelay: "300ms" }}>
          .
        </span>
      </div>
    </div>
  );
}
