"use client";
import { useState } from "react";

// 공유 버튼. 카카오톡 공유는 카카오 JavaScript 키가 있어야 해서 연결 때 더한다(Kakao Developers에 saju 도메인 등록 필요).
// 지금은 기기 공유 창(되는 기기에서) 또는 링크 복사.
export default function ShareActions({ url, title, label, note }: { url: string; title: string; label: string; note: string }) {
  const [done, setDone] = useState(false);
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setDone(true);
    } catch {
      /* 사용자가 공유 창을 닫은 경우 */
    }
  }
  return (
    <>
      <button className="btn kakao" onClick={share}>
        {label}
      </button>
      <p className="hint">{done ? "링크를 복사했어요." : note}</p>
    </>
  );
}
