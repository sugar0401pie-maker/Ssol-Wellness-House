"use client";

import { useEffect, useState } from "react";
import { gaegu } from "@/lib/fonts/gaegu";

// 도장 쾅(요청문 3-5-1장, 약 1.75초): 서버가 오늘 저장을 인정한 뒤에만 띄운다.
// 0초 도장판 + 오늘 칸 위에 도장 → 0.38초 내려옴 → 0.49초 닿음(빨간 "N일차 완료" 자국이 커졌다 자리잡음, 화면 한 번 흔들림, "쾅!", 낮은 "쿵") → 1.0초 들어 올림 → 1.75초 끝.
// 수달 그림(들어 올림·내려찍음·뿌듯)은 아직 없어 도장만 그린다(그림이 오면 이 자리에 넣는다). 움직임 줄이기: 도장 자국만 보여 주고 0.8초 뒤 끝.
// 소리는 저장 버튼을 누른 뒤에만 난다(파일 없이 코드로 만든 낮은 소리).
function thump() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(110, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(42, ac.currentTime + 0.22);
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.9, ac.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.32);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.35);
    window.setTimeout(() => void ac.close().catch(() => {}), 600);
  } catch {
    /* 소리 없이 */
  }
}

type Phase = "up" | "down" | "hit" | "lift";

export default function StampSlam({ n, onDone }: { n: number; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("up");
  const [reduce] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    const ts: number[] = [];
    if (reduce) {
      ts.push(window.setTimeout(() => setPhase("hit"), 0));
      ts.push(window.setTimeout(onDone, 800));
    } else {
      ts.push(window.setTimeout(() => setPhase("down"), 380));
      ts.push(
        window.setTimeout(() => {
          setPhase("hit");
          thump();
        }, 490),
      );
      ts.push(window.setTimeout(() => setPhase("lift"), 1000));
      ts.push(window.setTimeout(onDone, 1750));
    }
    return () => ts.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 한 번만 재생
  }, []);

  const hit = phase === "hit" || phase === "lift";
  const slotX = ["20%", "50%", "80%"];
  const stampTop = phase === "up" ? "-120%" : phase === "down" || phase === "hit" ? "-18%" : "-140%";

  return (
    <div className={`fixed inset-0 z-[70] ${gaegu.className}`} role="status" aria-live="assertive" aria-label={`${n}일차 도장을 찍었어요`}>
      <div className="absolute inset-0 bg-[rgba(5,12,28,.75)]" />
      <div
        className="absolute left-1/2 top-[38%] w-[min(86vw,380px)] -translate-x-1/2"
        style={!reduce && phase === "hit" ? { animation: "ssol-shake .26s linear" } : undefined}
      >
        <p className="mb-3 text-center text-[28px] font-bold text-night-text">쏠 작심삼일 챌린지</p>
        <div className="relative h-[150px] rotate-[-1.2deg] rounded-[22px] bg-night-text shadow-[0_8px_24px_rgba(0,0,0,.45)]">
          {[1, 2, 3].map((d, i) => {
            const on = d < n || (d === n && hit);
            return (
              <div key={d} className="absolute top-1/2 -ml-[44px] -mt-[44px] h-[88px] w-[88px]" style={{ left: slotX[i] }}>
                {on ? (
                  <div
                    className="grid h-full w-full rotate-[-10deg] place-items-center rounded-full border-[4px] border-stamp-red text-center font-bold leading-none text-stamp-red"
                    style={d === n && !reduce ? { animation: "ssol-stamp-pop .3s cubic-bezier(.2,1.7,.4,1) both" } : undefined}
                  >
                    <span className="text-[26px]">
                      {d}일차
                      <small className="mt-1 block text-[18px]">완료</small>
                    </span>
                  </div>
                ) : (
                  <div className="grid h-full w-full place-items-center rounded-full border-[3px] border-dashed border-[#cdbfa6] text-[32px] font-bold text-[#bba98a]">{d}</div>
                )}
                {d === n && !reduce && (
                  <div
                    aria-hidden="true"
                    className="absolute left-1/2 w-[70px] -translate-x-1/2"
                    style={{ top: stampTop, transition: phase === "down" ? "top .11s cubic-bezier(.6,0,1,.6)" : "top .3s ease-out", opacity: phase === "lift" ? 0 : 1 }}
                  >
                    <div className="mx-auto h-[38px] w-[30px] rounded-t-[12px] bg-[#8a5a2b]" />
                    <div className="h-[22px] w-[70px] rounded-[6px] bg-stamp-red shadow-[0_3px_0_#8a2f1f]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {hit && !reduce && (
          <p
            aria-hidden="true"
            className="pointer-events-none absolute -right-2 -top-10 rotate-[-9deg] text-[64px] font-bold text-night-yellow"
            style={{ textShadow: "0 3px 0 #8a3b1d, 0 0 14px rgba(255,211,107,.6)", animation: "ssol-stamp-pop .5s cubic-bezier(.2,1.8,.4,1) both" }}
          >
            쾅!
          </p>
        )}
      </div>
    </div>
  );
}
