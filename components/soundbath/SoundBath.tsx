"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AUTO_MIN_MS, AUTO_SPAN_MS, BOWLS, REST_POSE, RETURN_MS, RIPPLE_MS, TOUR_GAP_MS, hitArea, nextAutoBowl, posePlacement } from "@/lib/soundbath/layout";

// 사운드 배스(요청문 v1.9.4 4·14-4장): 달밤 호숫가, 크리스털 보울 5개가 한 줄, 해달이 가운데 앉아 있다.
// 보울을 누르면 해달이 그 보울을 치는 자세로 바뀌고 소리와 물결이 난다(옮겨 다니지 않음). 4.5초 뒤 가운데 앉기로 돌아온다.
// 소리는 녹음 파일이 오기 전까지 코드로 만든 싱잉볼 소리(시안과 같은 음). 진동은 쓰지 않는다. 소리는 화면을 누른 뒤에만 켜진다(브라우저 규칙).
// 움직임 줄이기: 물결 없이 자세만 바꾸고 소리만 낸다. 하단 메뉴 없음(이 틀 밖의 화면). 돌아가기는 들어온 화면(마이페이지 "웰니스 상담 신청하기")으로.

type Ripple = { key: number; bowl: number };
const autoDelay = () => AUTO_MIN_MS + Math.random() * AUTO_SPAN_MS;
const autoPick = (last: number | null) => nextAutoBowl(last, Math.random());

export default function SoundBath() {
  const router = useRouter();
  const [pose, setPose] = useState(REST_POSE);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [auto, setAuto] = useState(false);
  const [reduce] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const ac = useRef<{ ctx: AudioContext; master: GainNode } | null>(null);
  const timers = useRef<{ back?: number; tour: number[]; auto?: number }>({ tour: [] });
  const last = useRef<number | null>(null);
  const rippleKey = useRef(0);

  useEffect(() => {
    const t = timers.current;
    return () => {
      window.clearTimeout(t.back);
      window.clearTimeout(t.auto);
      t.tour.forEach((x) => window.clearTimeout(x));
      void ac.current?.ctx.close().catch(() => {});
    };
  }, []);

  function audio() {
    try {
      if (!ac.current) {
        const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!C) return null;
        const ctx = new C();
        const comp = ctx.createDynamicsCompressor();
        const master = ctx.createGain();
        master.gain.value = 0.5;
        const d = ctx.createDelay(1);
        d.delayTime.value = 0.32;
        const fb = ctx.createGain();
        fb.gain.value = 0.28;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 2200;
        master.connect(comp);
        master.connect(d);
        d.connect(lp);
        lp.connect(fb);
        fb.connect(d);
        lp.connect(comp);
        comp.connect(ctx.destination);
        ac.current = { ctx, master };
      }
      if (ac.current.ctx.state === "suspended") void ac.current.ctx.resume();
      return ac.current;
    } catch {
      return null;
    }
  }

  // 싱잉볼: 기본음 + 배음 3개, 양옆으로 살짝 어긋난 음을 겹쳐 맥놀이(울림)를 낸다.
  function sing(freq: number) {
    const a = audio();
    if (!a) return;
    const t = a.ctx.currentTime;
    for (const [mult, amp, dur] of [
      [1, 1, 5.5],
      [2.71, 0.38, 3.6],
      [5.15, 0.16, 2.2],
      [7.9, 0.07, 1.4],
    ]) {
      for (const sg of [-1, 1]) {
        const o = a.ctx.createOscillator();
        const g = a.ctx.createGain();
        o.type = "sine";
        o.frequency.value = freq * mult + sg * 1.2 * (mult > 1 ? 1.4 : 1);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.16 * amp, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g);
        g.connect(a.master);
        o.start(t);
        o.stop(t + dur + 0.1);
      }
    }
  }

  function strike(id: number) {
    const b = BOWLS.find((x) => x.id === id);
    if (!b) return;
    last.current = id;
    setPose(id);
    sing(b.freq);
    if (!reduce) {
      const key = ++rippleKey.current;
      setRipples((r) => [...r, { key, bowl: id }]);
      window.setTimeout(() => setRipples((r) => r.filter((x) => x.key !== key)), RIPPLE_MS + 100);
    }
    window.clearTimeout(timers.current.back);
    timers.current.back = window.setTimeout(() => setPose(REST_POSE), RETURN_MS);
  }

  function stopAll() {
    timers.current.tour.forEach((x) => window.clearTimeout(x));
    timers.current.tour = [];
    window.clearTimeout(timers.current.auto);
    timers.current.auto = undefined;
    setAuto(false);
  }

  function tour() {
    stopAll();
    BOWLS.forEach((b, i) => timers.current.tour.push(window.setTimeout(() => strike(b.id), i * TOUR_GAP_MS)));
  }

  function loopAuto() {
    strike(autoPick(last.current));
    timers.current.auto = window.setTimeout(loopAuto, autoDelay());
  }

  function toggleAuto() {
    if (auto) {
      stopAll();
      return;
    }
    stopAll();
    setAuto(true);
    loopAuto();
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0a1224]">
      <div className="relative overflow-hidden text-[#fdf6e9]" style={{ width: "min(100vw, 50dvh)", aspectRatio: "1 / 2", containerType: "inline-size" }}>
        <Image src="/soundbath/bg.webp" alt="달밤 호숫가에 크리스털 보울 다섯 개가 한 줄로 놓여 있고, 해달이 그 뒤에 앉아 있어요" fill unoptimized priority className="object-cover" />
        {/* 해달 — 자세가 바뀌어도 미리 받아 두려고 다섯 장을 다 깔고 지금 자세만 보인다 */}
        {[1, 2, 3, 4, 5].map((n) => {
          const p = posePlacement(n);
          return (
            <Image
              key={n}
              src={`/soundbath/otter${n}.webp`}
              alt=""
              aria-hidden="true"
              width={300}
              height={300}
              unoptimized
              loading="eager"
              className="pointer-events-none absolute h-auto"
              style={{ left: `${p.left}%`, top: `${p.top}%`, width: `${p.width}%`, opacity: n === pose ? 1 : 0, transition: reduce ? "none" : "opacity .3s" }}
            />
          );
        })}
        <Image src="/soundbath/bowls.webp" alt="" aria-hidden="true" fill unoptimized className="pointer-events-none object-cover" />

        {ripples.map((r) => {
          const b = BOWLS.find((x) => x.id === r.bowl)!;
          const [x, y, w, h] = b.rect;
          return (
            <span
              key={r.key}
              aria-hidden="true"
              className="pointer-events-none absolute rounded-[50%] border-2 border-[rgba(220,238,255,.75)]"
              style={{ left: `${((x + w / 2) / 1080) * 100}%`, top: `${((y + h * 0.82) / 2160) * 100}%`, width: `${(w / 1080) * 100}%`, aspectRatio: "3 / 1", translate: "-50% -50%", animation: `ssol-ripple ${RIPPLE_MS}ms ease-out forwards` }}
            />
          );
        })}

        {BOWLS.map((b) => {
          const a = hitArea(b);
          return (
            <button
              key={b.id}
              type="button"
              aria-label={`${b.name} 울리기`}
              onClick={() => {
                stopAll();
                strike(b.id);
              }}
              className="absolute rounded-[40%] focus-visible:outline-2 focus-visible:outline-[#ffd36b]"
              style={{ left: `${a.left}%`, top: `${a.top}%`, width: `${a.width}%`, height: `${a.height}%` }}
            />
          );
        })}

        <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.replace("/mypage"))} className="absolute z-10 rounded-full border text-[#cfe0f5]" style={{ left: "4cqw", top: "4cqw", fontSize: "3.6cqw", padding: "1.6cqw 3.4cqw", background: "rgba(8,20,42,.55)", borderColor: "rgba(188,208,234,.35)" }}>
          돌아가기
        </button>
        <div className="absolute z-[3] text-left" style={{ left: "6cqw", right: "32cqw", top: "15cqw", textShadow: "0 1px 8px rgba(5,12,30,.85)" }}>
          <h1 className="font-bold" style={{ fontSize: "6.4cqw" }}>
            사운드 배스
          </h1>
          <p className="text-[#e3edf9]" style={{ fontSize: "3.8cqw", lineHeight: 1.45, marginTop: "1.5cqw" }}>
            보울을 눌러 보세요. 해달이 울려 줘요.
          </p>
        </div>
        <div className="absolute z-[5] flex" style={{ left: "6cqw", right: "6cqw", top: "40cqw", gap: "2.5cqw" }}>
          <button type="button" onClick={tour} className="flex-1 rounded-full border border-[#5b79a6] bg-[rgba(8,20,42,.55)]" style={{ fontSize: "3.8cqw", padding: "2.4cqw 0" }}>
            차례로 울리기
          </button>
          <button
            type="button"
            aria-pressed={auto}
            onClick={toggleAuto}
            className={`flex-1 rounded-full border ${auto ? "border-[#f3b04c] bg-[#f3b04c] text-[#3b2208]" : "border-[#5b79a6] bg-[rgba(8,20,42,.55)]"}`}
            style={{ fontSize: "3.8cqw", padding: "2.4cqw 0" }}
          >
            알아서 울리기
          </button>
        </div>
        <p className="absolute inset-x-0 z-[5] text-center text-[#f2f6ff]" style={{ bottom: "9cqw", fontSize: "3.6cqw", textShadow: "0 1px 6px rgba(5,12,30,.95)" }}>
          아무 생각 안 해도 돼요.
          <span className="mt-1 block text-[#b8c9e2]" style={{ fontSize: "3cqw" }}>
            소리가 안 들리면 무음 모드를 확인해 주세요.
          </span>
        </p>
      </div>
    </div>
  );
}
