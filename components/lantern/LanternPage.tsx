"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import {
  LANTERN_ALREADY_TEXT,
  LANTERN_DONE_TEXT,
  LANTERN_SCENES,
  SCENE_MS,
  WISH_BOX,
  WISH_MAX,
  normalizeWish,
} from "@/lib/lantern/config";

// 풍등 날리기 화면(2026-11-25, 요청문 v1.9.4 2장·14-2장).
// 장면 1(풍등 안에 소원 쓰기) → 날리기 → 장면 2(1.5초) → 3(1.5초) → 4(5초) → 장면 5(박수) + "풍등이 잘 날아갔어요!" + 홈으로.
// 그림 안에 풍등이 그려져 있어서(풍등만 따로 둔 그림은 기획자가 나중에 전달) 소원 글자는 그림 속 풍등 자리를 따라 옮긴다:
//   장면 1·2에서는 풍등을 따라가고, 장면 3에서 흐려진다(대표님 2026-11-25). 끝 화면에 "소원은 천천히 흐려져요"는 쓰지 않는다(대표님: 어차피 DB에 남음).
// 소원은 날리기를 누르는 순간 서버에 먼저 저장하고(하루 한 번, KST), 저장이 된 뒤에 장면을 이어 간다.
// 움직임 줄이기를 켠 기기에서는 장면 2~4를 건너뛰고 끝 화면만 보여 준다. 풍등 색 고르기는 꺼 둠(풍등만 따로 둔 그림이 오기 전까지).

type Phase = "loading" | "compose" | "sending" | "flying" | "done" | "already" | "closed";
type Scene = 1 | 2 | 3 | 4 | 5;

const SKY = "#0b2b55"; // 그림 맨 위 하늘 색 — 화면 비율이 달라 남는 위아래·양옆을 같은 색으로 채운다
const INK = "#4a2a0a";

function wishBoxStyle(scene: Scene): React.CSSProperties {
  const box = scene <= 1 ? WISH_BOX[1] : scene === 2 ? WISH_BOX[2] : WISH_BOX[3];
  return {
    left: `${box.cx}%`,
    top: `${box.cy}%`,
    width: `${box.w}%`,
    transform: "translate(-50%, -50%)",
    opacity: scene <= 2 ? 1 : 0,
    transition: `left ${SCENE_MS[2]}ms ease-in-out, top ${SCENE_MS[2]}ms ease-in-out, width ${SCENE_MS[2]}ms ease-in-out, opacity 1200ms ease-in`,
  };
}

// 장면 3·4는 같은 크기 그림이라, 카메라가 올라가는 느낌을 살짝 확대돼 있다가 제자리로 돌아오는 움직임으로 낸다(14-2장 제안).
function sceneStyle(n: Scene, scene: Scene): React.CSSProperties {
  const active = n === scene;
  const drift = n === 3 || n === 4;
  return {
    opacity: active ? 1 : 0,
    transform: drift && !active ? "scale(1.05)" : "scale(1)",
    transformOrigin: "50% 100%",
    transition: `opacity 600ms ease-in-out, transform ${n === 4 ? SCENE_MS[4] : SCENE_MS[3]}ms ease-out`,
  };
}

// getToken: 화면 확인용으로 바꿔 끼울 수 있게 둔 자리(실제 화면은 기본값 — 로그인 세션의 토큰).
export default function LanternPage({ getToken = getAccessToken }: { getToken?: () => Promise<string | null> } = {}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [scene, setScene] = useState<Scene>(1);
  const [wish, setWish] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token) return void (!cancelled && setPhase("compose"));
      try {
        const res = await fetch("/api/lantern", { headers: authHeaders(token), cache: "no-store" });
        const json = (await res.json()) as { open?: boolean; flownToday?: boolean };
        if (cancelled) return;
        if (json.flownToday) {
          setScene(5);
          setPhase("already");
        } else if (json.open === false) {
          setScene(5);
          setPhase("closed");
        } else setPhase("compose");
      } catch {
        if (!cancelled) setPhase("compose"); // 상태를 못 읽어도 쓰기는 열어 둔다(저장할 때 서버가 다시 판단)
      }
    })();
    const list = timers.current;
    return () => {
      cancelled = true;
      list.forEach((t) => window.clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 열 때 한 번만 읽는다
  }, []);

  function fly() {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setScene(5);
      setPhase("done");
      return;
    }
    setPhase("flying");
    setScene(2);
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    at(SCENE_MS[2], () => setScene(3));
    at(SCENE_MS[2] + SCENE_MS[3], () => setScene(4));
    at(SCENE_MS[2] + SCENE_MS[3] + SCENE_MS[4], () => {
      setScene(5);
      setPhase("done");
    });
  }

  async function release() {
    const w = normalizeWish(wish);
    if (!w) {
      setMessage("소원을 한 줄 적어 주세요.");
      return;
    }
    setPhase("sending");
    setMessage(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("login");
      const res = await fetch("/api/lantern", { method: "POST", headers: authHeaders(token), body: JSON.stringify({ wish: w }) });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; help?: boolean; reason?: string; message?: string };
      if (json.ok) {
        setWish(w);
        setHelp(!!json.help);
        fly();
      } else if (json.reason === "already") {
        setScene(5);
        setPhase("already");
      } else if (json.reason === "closed") {
        setScene(5);
        setPhase("closed");
      } else {
        setPhase("compose");
        setMessage(json.message ?? "지금은 풍등을 날리지 못했어요. 잠시 후 다시 해 주세요.");
      }
    } catch {
      setPhase("compose");
      setMessage("지금은 풍등을 날리지 못했어요. 잠시 후 다시 해 주세요.");
    }
  }

  const writing = phase === "compose" || phase === "sending";
  const ended = phase === "done" || phase === "already" || phase === "closed";
  const count = [...wish].length;

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: SKY }}>
      <div
        className="relative overflow-hidden font-sans"
        style={{ width: "min(100vw, 50dvh)", aspectRatio: "1 / 2", containerType: "inline-size" }}
      >
        {LANTERN_SCENES.map((s) => (
          <Image
            key={s.n}
            src={s.src}
            alt={s.n === scene ? s.alt : ""}
            aria-hidden={s.n !== scene}
            fill
            unoptimized
            loading="eager"
            className="object-cover"
            style={sceneStyle(s.n, scene)}
          />
        ))}

        {/* 장면 1 위쪽: 제목·설명(쓰는 동안만) */}
        {writing && (
          <div className="absolute inset-x-0 text-center" style={{ top: "6.5%", padding: "0 6cqw" }}>
            <h1 className="font-serif font-bold text-[#fdf6e9]" style={{ fontSize: "5.6cqw", lineHeight: 1.4 }}>
              소원을 적어 풍등을 날려요
            </h1>
            <p className="text-[#cfe0f5]" style={{ fontSize: "3.5cqw", lineHeight: 1.5, marginTop: "1cqw" }}>
              한 줄만 적어도 돼요. 소원은 하늘로 올라가면 흐려져요.
            </p>
          </div>
        )}

        {/* 소원 글자 — 쓰는 동안은 풍등 안의 진짜 입력창, 날리면 같은 자리의 글자가 풍등을 따라 올라가다 흐려진다 */}
        {writing ? (
          <div className="absolute" style={wishBoxStyle(1)}>
            <label htmlFor="wish" className="sr-only">
              소원 입력
            </label>
            <textarea
              id="wish"
              value={wish}
              maxLength={WISH_MAX}
              rows={3}
              disabled={phase === "sending"}
              placeholder="오늘 바라는 걸 한 줄로 적어 보세요"
              onChange={(e) => {
                setWish(e.target.value.replace(/\n/g, ""));
                if (message) setMessage(null);
              }}
              onKeyDown={(e) => {
                // 한 줄 소원이라 줄바꿈은 막는다(보내기는 버튼으로만 — 한글 조합 중 Enter 오작동 방지)
                if (e.key === "Enter") e.preventDefault();
              }}
              className="block w-full resize-none break-keep bg-transparent text-center outline-none placeholder:text-[#a3804f]"
              style={{ fontSize: "5.4cqw", lineHeight: 1.5, color: INK, textShadow: "0 0 2cqw rgba(255,236,190,.9)" }}
            />
            <p className="text-center" style={{ fontSize: "3.2cqw", color: "#8a5a2b", marginTop: "2cqw" }} aria-live="polite">
              {count} / {WISH_MAX}자까지
            </p>
          </div>
        ) : (
          (phase === "flying" || phase === "done") && (
            <p
              className="pointer-events-none absolute text-center break-keep"
              aria-hidden="true"
              style={{ ...wishBoxStyle(scene), fontSize: "5.4cqw", lineHeight: 1.5, color: INK, textShadow: "0 0 2cqw rgba(255,236,190,.9)" }}
            >
              {wish}
            </p>
          )
        )}

        {/* 나중에 할게요(쓰는 동안 왼쪽 위) */}
        {writing && (
          <Link
            href="/home"
            replace
            className="absolute z-10 rounded-full border text-[#cfe0f5]"
            style={{ left: "4cqw", top: "4cqw", fontSize: "3.6cqw", padding: "1.6cqw 3.4cqw", background: "rgba(8,20,42,.55)", borderColor: "rgba(188,208,234,.35)" }}
          >
            나중에 할게요
          </Link>
        )}

        {/* 끝 화면 문구 */}
        {ended && (
          <div
            className="absolute break-keep text-center text-[#fdf6e9]"
            role="status"
            aria-live="polite"
            style={{ left: "8%", right: "8%", top: "22%", padding: "5cqw 5cqw", background: "rgba(8,20,42,.62)", borderRadius: "5cqw" }}
          >
            {phase === "done" ? (
              <p className="font-serif font-bold" style={{ fontSize: "7.2cqw", lineHeight: 1.35 }}>
                {LANTERN_DONE_TEXT}
              </p>
            ) : (
              <p style={{ fontSize: "4.6cqw", lineHeight: 1.6 }}>{phase === "already" ? LANTERN_ALREADY_TEXT : "지금은 풍등 날리기 기간이 아니에요."}</p>
            )}
            {phase === "done" && help && (
              <Link href="/help" className="inline-block underline underline-offset-4 text-[#cfe0f5]" style={{ fontSize: "3.6cqw", marginTop: "3cqw" }}>
                마음이 많이 힘들 땐 이야기할 수 있는 곳도 있어요
              </Link>
            )}
          </div>
        )}

        {/* 아래 버튼 */}
        {message && writing && (
          <p className="absolute inset-x-0 text-center" style={{ bottom: "14%", padding: "0 8cqw" }} role="alert">
            <span className="inline-block rounded-full text-[#fdf6e9]" style={{ fontSize: "3.6cqw", padding: "1.6cqw 3.6cqw", background: "rgba(8,20,42,.7)" }}>
              {message}
            </span>
          </p>
        )}
        {writing && (
          <button
            type="button"
            onClick={release}
            disabled={phase === "sending" || !wish.trim()}
            className="absolute left-1/2 -translate-x-1/2 rounded-full font-medium disabled:opacity-55"
            style={{ bottom: "5%", width: "74%", fontSize: "4.6cqw", padding: "3.2cqw 0", background: "#f3b04c", color: "#3b2208" }}
          >
            {phase === "sending" ? "날리는 중…" : "풍등 날리기"}
          </button>
        )}
        {ended && (
          <Link
            href="/home"
            replace
            className="absolute left-1/2 -translate-x-1/2 rounded-full text-center font-medium"
            style={{ bottom: "5%", width: "74%", fontSize: "4.6cqw", padding: "3.2cqw 0", background: "#f3b04c", color: "#3b2208" }}
          >
            홈으로
          </Link>
        )}
      </div>
    </div>
  );
}
