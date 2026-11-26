"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import {
  CAPTION_MS,
  CELEBRATE_TEXT_BOTTOM,
  FLYING_CAPTIONS,
  LANTERN_ALREADY_SUB,
  LANTERN_DONE_TEXT,
  lanternSetFor,
  type LanternSet,
  SCENE_MS,
  WISH_BOX,
  WISH_MAX,
  normalizeWish,
} from "@/lib/lantern/config";
import {
  altitudeKm,
  pickAltitudeLine,
  renderAltitudeLine,
} from "@/lib/lantern/altitude";
import { drawWishCard } from "@/lib/lantern/shareCard";
import { canvasToBlob, notoFamily } from "@/lib/challenge/card";
import { downloadBlob, shareToKakao } from "@/lib/challenge/share";
import { KakaoSymbol } from "@/components/auth/SocialLogos";

// 날린 뒤 화면(대표님 2026-11-26): 공유하기(카카오톡 — 내가 쓴 소원 화면 그림, lib/lantern/shareCard.ts) · 소원 다시 보기(/lantern/wish, 고쳐서 다시 날릴 수 있음).
// 그 그림은 풍등을 날리면 자동으로 앨범(내려받기)에 저장된다.
const SHARE_FILE = "ssol-lantern-2027.png";
// 문장 고르기용 난수·지금 시각(이벤트 처리 안에서만 부른다 — 화면을 그리는 중에 부르는 게 아님)
const rand = () => Math.random();
const nowMs = () => Date.now();
const SHARE_URL = "https://app.ssolwellnesshouse.com/lantern";

// 풍등 날리기 화면(2026-11-25, 요청문 v1.9.4 2장·14-2장).
// 장면 1(풍등 안에 소원 쓰기) → 날리기 → 장면 2(1.5초) → 3(1.5초) → 4(5초) → 장면 5(박수) + "풍등이 잘 날아갔어요!" + 홈으로.
// 저장은 장면이 이어지는 동안 함께 한다(대표님 2026-11-25) — 그동안 아래에 "소중한 마음을 풍등에 담고 있어요…" 같은 안내가 2초마다 바뀐다.
//   저장이 장면보다 늦으면 장면 4에 머문 채 안내가 계속 돌고, 저장이 실패하면 장면 1로 돌아와 다시 날릴 수 있다(쓴 소원은 그대로).
// 그림 안에 풍등이 그려져 있어서(풍등만 따로 둔 그림은 기획자가 나중에 전달) 소원 글자는 그림 속 풍등 자리를 따라 옮긴다:
//   장면 1·2에서는 풍등을 따라가고, 장면 3에서 흐려진다(대표님). 끝 화면에 "소원은 천천히 흐려져요"는 쓰지 않는다(대표님: 어차피 DB에 남음).
// 새해까지 한 번만(대표님) — 이미 날린 사람에게는 "○○님의 풍등은 지금 … km 상공에 가고 있어요"(높이는 날린 시각부터 계속 올라감, lib/lantern/altitude.ts).
// 소원 글에는 위기 표현 확인·도움 안내를 붙이지 않는다(대표님 2026-11-25 — 채팅이 아닌 이벤트 글에 안전 장치를 과하게 얹지 않음).
// 움직임 줄이기를 켠 기기에서는 장면 2~4를 건너뛴다. 풍등 색 고르기는 꺼 둠(풍등만 따로 둔 그림이 오기 전까지).

type Phase = "loading" | "compose" | "flying" | "done" | "already" | "closed";
type Scene = 1 | 2 | 3 | 4 | 5;
type Status = {
  open?: boolean;
  flown?: boolean;
  flownAt?: string | null;
  wish?: string | null;
  name?: string | null;
};
type SaveResult = {
  ok?: boolean;
  flownAt?: string;
  reason?: string;
  message?: string;
};

const SKY = "var(--night-deep)"; // 그림 맨 위 하늘 색 — 화면 비율이 달라 남는 위아래·양옆을 같은 색으로 채운다
const INK = "#4a2a0a";
const SAVE_FAIL = "풍등이 잠시 구름에 걸렸어요. 잠시 후 다시 날려 볼까요?";

function wishBoxStyle(scene: Scene): React.CSSProperties {
  const box =
    scene <= 1 ? WISH_BOX[1] : scene === 2 ? WISH_BOX[2] : WISH_BOX[3];
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
function sceneStyle(
  n: Scene,
  scene: Scene,
  allowDrift = true,
): React.CSSProperties {
  const active = n === scene;
  const drift = allowDrift && (n === 3 || n === 4); // 풍등이 따로인 묶음은 풍등 자리가 어긋나지 않게 확대 연출을 뺀다
  return {
    opacity: active ? 1 : 0,
    transform: drift && !active ? "scale(1.05)" : "scale(1)",
    transformOrigin: "50% 100%",
    transition: `opacity 600ms ease-in-out, transform ${n === 4 ? SCENE_MS[4] : SCENE_MS[3]}ms ease-out`,
  };
}

// getToken: 화면 확인용으로 바꿔 끼울 수 있게 둔 자리(실제 화면은 기본값 — 로그인 세션의 토큰).
// 화면마다 주소(대표님 2026-11-25 "화면 바꾸면 무조건 링크 나눠"): 쓰기 /lantern · 날린 뒤(축하·높이) /lantern/done · 날린 소원 다시 보기·고치기 /lantern/wish.
// 날아가는 장면은 쓰기 → 끝 화면으로 이어지는 움직임이라 페이지를 새로 그리지 않고 주소만 바꾼다(history.replaceState — Next.js 라우터와 맞춰짐).
// /lantern/done으로 바로 들어왔는데 아직 안 날렸으면 쓰기 화면(/lantern)으로.
function setLanternPath(path: "/lantern" | "/lantern/done" | "/lantern/wish") {
  try {
    if (window.location.pathname !== path) window.history.replaceState(window.history.state, "", path);
  } catch {
    /* 주소를 못 바꿔도 화면은 그대로 */
  }
}

export default function LanternPage({
  getToken = getAccessToken,
}: { getToken?: () => Promise<string | null> } = {}) {
  const [phase, setPhase] = useState<Phase>("loading");
  // 그림 묶음(수달·해달 / 펭귄·비버) — 열 때마다 무작위(대표님 2026-11-25)
  const [art, setArt] = useState<LanternSet | null>(null);
  const [scene, setScene] = useState<Scene>(1);
  const [wish, setWish] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [caption, setCaption] = useState(0);
  const [name, setName] = useState<string | null>(null);
  const [flownAt, setFlownAt] = useState<string | null>(null);
  const [lineRand, setLineRand] = useState(0);
  const [now, setNow] = useState(0);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [savedWish, setSavedWish] = useState<string | null>(null); // 이미 날린 소원(본인 것)
  const [open, setOpen] = useState(true); // 이벤트 기간인지(지나면 고치기 버튼을 숨김)
  const [editing, setEditing] = useState(false); // 날린 소원을 고치는 중(/lantern/wish)
  const timers = useRef<number[]>([]);
  const flight = useRef({ animDone: false, saved: null as SaveResult | null, wish: "", edit: false });

  function clearTimers() {
    timers.current.forEach((t) => {
      window.clearTimeout(t);
      window.clearInterval(t);
    });
    timers.current = [];
  }

  function showAlready(at: string | null) {
    clearTimers();
    setFlownAt(at);
    setLineRand(rand()); // 열 때마다 다른 문장(그 높이에 맞는 것 중에서)
    setNow(nowMs());
    setScene(5);
    setEditing(false);
    setPhase("already");
    setLanternPath("/lantern/done");
  }

  // 소원 다시 보기(대표님 2026-11-26): 날린 소원을 쓰던 화면으로 — 고쳐서 다시 날리면 소원만 바뀌고 날린 시각(높이)은 그대로.
  function startEdit(w: string, at: string | null) {
    clearTimers();
    setFlownAt(at);
    setWish(w);
    setMessage(null);
    setShareNote(null);
    setScene(1);
    setEditing(true);
    setPhase("compose");
    setLanternPath("/lantern/wish");
  }

  async function loadStatus(): Promise<Status | null> {
    const token = await getToken();
    if (!token) return null;
    const res = await fetch("/api/lantern", {
      headers: authHeaders(token),
      cache: "no-store",
    });
    return (await res.json()) as Status;
  }

  useEffect(() => {
    let cancelled = false;
    loadStatus()
      .then((s) => {
        if (cancelled) return;
        setArt(lanternSetFor(Math.random()));
        if (s?.name) setName(s.name);
        if (s?.open === false) setOpen(false);
        if (s?.flown) {
          setSavedWish(s.wish ?? null);
          // /lantern/wish로 들어왔으면(기간 중) 날린 소원을 쓰던 화면으로, 아니면 날린 뒤 화면
          if (window.location.pathname === "/lantern/wish" && s.open !== false && s.wish) startEdit(s.wish, s.flownAt ?? null);
          else showAlready(s.flownAt ?? null);
        }
        else if (s?.open === false) {
          setScene(1); // 축하 그림(장면 5)에는 "날아갔어요" 글자가 있어서 기간이 아닐 때는 첫 장면
          setPhase("closed");
          setLanternPath("/lantern");
        } else {
          setPhase("compose");
          setLanternPath("/lantern");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setArt(lanternSetFor(Math.random()));
        setPhase("compose"); // 상태를 못 읽어도 쓰기는 열어 둔다(저장할 때 서버가 다시 판단)
      });
    return () => {
      cancelled = true;
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 열 때 한 번만 읽는다
  }, []);

  // 이미 날린 화면: 높이 숫자가 보는 동안에도 올라가게 1초마다 다시 그린다.
  useEffect(() => {
    if (phase !== "already" && phase !== "done") return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  // 장면이 끝났고 저장도 끝났으면 끝 화면.
  function tryFinish() {
    const f = flight.current;
    if (!f.animDone || !f.saved?.ok) return;
    clearTimers();
    setFlownAt(f.saved.flownAt ?? null);
    setLineRand(rand());
    setNow(nowMs());
    setScene(5);
    setSavedWish(f.wish);
    setEditing(false);
    setPhase("done");
    setLanternPath("/lantern/done");
    void autoSave(f.wish); // 날리면 내가 쓴 소원 그림을 자동으로 저장(대표님 2026-11-26)
  }

  // 저장이 안 됐을 때 — 날던 장면을 멈추고 상황에 맞는 화면으로.
  function abortFlight(r: SaveResult | null) {
    clearTimers();
    if (r?.reason === "already") {
      loadStatus()
        .then((s) => showAlready(s?.flownAt ?? null))
        .catch(() => showAlready(null));
    } else if (r?.reason === "closed") {
      setScene(1);
      setPhase("closed");
    } else {
      setScene(1);
      setPhase("compose");
      setMessage(r?.message ?? SAVE_FAIL);
    }
  }

  async function save(w: string) {
    let r: SaveResult | null = null;
    try {
      const token = await getToken();
      if (!token) throw new Error("login");
      const res = await fetch("/api/lantern", {
        method: flight.current.edit ? "PATCH" : "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ wish: w }),
      });
      r = (await res.json().catch(() => ({}))) as SaveResult;
    } catch {
      r = null;
    }
    if (r?.ok) {
      flight.current.saved = r;
      tryFinish();
    } else abortFlight(r);
  }

  function release() {
    const w = normalizeWish(wish);
    if (!w) {
      setMessage("소원을 한 줄 적어 주세요.");
      return;
    }
    clearTimers();
    flight.current = { animDone: false, saved: null, wish: w, edit: editing };
    setWish(w);
    setMessage(null);
    setCaption(0);
    setPhase("flying");
    const at = (ms: number, fn: () => void) =>
      timers.current.push(window.setTimeout(fn, ms));
    timers.current.push(
      window.setInterval(
        () => setCaption((i) => (i + 1) % FLYING_CAPTIONS.length),
        CAPTION_MS,
      ),
    );
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      flight.current.animDone = true; // 장면 1에 머문 채 안내만 보여 주고, 저장되면 바로 끝 화면
    } else {
      setScene(2);
      at(SCENE_MS[2], () => setScene(3));
      at(SCENE_MS[2] + SCENE_MS[3], () => setScene(4));
      at(SCENE_MS[2] + SCENE_MS[3] + SCENE_MS[4], () => {
        flight.current.animDone = true;
        tryFinish(); // 저장이 아직이면 장면 4에서 안내가 계속 돈다
      });
    }
    void save(w);
  }

  const writing = phase === "compose";
  const ended = phase === "done" || phase === "already" || phase === "closed";
  const count = [...wish].length;
  const altitudeText =
    (phase === "already" || phase === "done") && now > 0
      ? (() => {
          const km = flownAt ? altitudeKm(flownAt, now) : 1;
          return renderAltitudeLine(pickAltitudeLine(km, lineRand), km, name);
        })()
      : "";

  async function makeWishCard(w: string): Promise<Blob> {
    const set = art ?? lanternSetFor(0);
    return canvasToBlob(await drawWishCard(set, w, notoFamily()));
  }
  async function autoSave(w: string) {
    try {
      if (downloadBlob(await makeWishCard(w), SHARE_FILE)) setShareNote("앨범에 저장했어요.");
    } catch {
      /* 저장은 못 해도 공유하기로 다시 만들 수 있다 */
    }
  }
  async function shareCard() {
    const w = savedWish ?? wish;
    if (shareBusy || !w) return;
    setShareBusy(true);
    setShareNote(null);
    try {
      await shareToKakao(await makeWishCard(w), SHARE_FILE, { title: LANTERN_DONE_TEXT, description: altitudeText, url: SHARE_URL });
    } catch {
      setShareNote("지금은 공유하지 못했어요. 잠시 후 다시 해 주세요.");
    } finally {
      setShareBusy(false);
    }
  }

  // 풍등 안 소원 입력칸(두 그림 묶음이 같이 쓴다) — size·small은 글자 크기(풍등 폭 또는 화면 폭 기준)
  const wishInput = (size: string, small: string) => (
    <>
      <label htmlFor="wish" className="sr-only">
        소원 입력
      </label>
      <textarea
        id="wish"
        value={wish}
        maxLength={WISH_MAX}
        rows={3}
        placeholder={"2027년을 맞이하는\n내 다짐과 소원을\n편하게 적어보세요"} // 대표님 2026-11-25 문구·줄바꿈
        onChange={(e) => {
          setWish(e.target.value.replace(/\n/g, ""));
          if (message) setMessage(null);
        }}
        onKeyDown={(e) => {
          // 한 줄 소원이라 줄바꿈은 막는다(보내기는 버튼으로만 — 한글 조합 중 Enter 오작동 방지)
          if (e.key === "Enter") e.preventDefault();
        }}
        className="block w-full resize-none break-keep bg-transparent text-center outline-none placeholder:text-[#a3804f]"
        style={{
          fontSize: size,
          lineHeight: 1.5,
          color: INK,
          textShadow: "0 0 2cqw rgba(255,236,190,.9)",
        }}
      />
      <p
        className="text-center"
        style={{ fontSize: small, color: "#8a5a2b", marginTop: "2cqw" }}
        aria-live="polite"
      >
        {count} / {WISH_MAX}자까지
      </p>
    </>
  );

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: SKY }}
    >
      <div
        className="relative overflow-hidden font-sans"
        style={{
          width: "min(100vw, 50dvh)",
          aspectRatio: "1 / 2",
          containerType: "inline-size",
        }}
      >
        {(art?.scenes ?? []).map((s) => (
          <Image
            key={s.n}
            src={s.src}
            alt={s.n === scene ? s.alt : ""}
            aria-hidden={s.n !== scene}
            fill
            unoptimized
            loading="eager"
            className="object-cover"
            style={sceneStyle(s.n, scene, !art?.lantern)}
          />
        ))}

        {/* 장면 1 위쪽: 제목·설명(쓰는 동안만) */}
        {writing && (
          <div
            className="absolute inset-x-0 text-center"
            style={{ top: "6.5%", padding: "0 6cqw" }}
          >
            <h1
              className="font-serif font-bold text-night-text"
              style={{ fontSize: "5.6cqw", lineHeight: 1.4 }}
            >
              소원을 적어 풍등을 날려요
            </h1>
            <p
              className="text-night-soft"
              style={{ fontSize: "3.5cqw", lineHeight: 1.5, marginTop: "1cqw" }}
            >
              한 줄만 적어도 돼요.
            </p>
          </div>
        )}

        {/* 소원 글자 — 쓰는 동안은 풍등 안의 진짜 입력창, 날리면 같은 자리의 글자가 풍등을 따라 올라가다 장면 3에서 흐려진다 */}
        {art?.lantern ? (
          // 펭귄·비버: 풍등 그림과 소원 글자가 한 묶음으로 움직인다(글자 크기는 풍등 폭에 맞춰 함께 줄어듦)
          (writing || phase === "flying") &&
          scene <= 4 && (
            <div
              className="absolute"
              style={{
                left: `${art.lantern.frames[scene as 1 | 2 | 3 | 4].left}%`,
                top: `${art.lantern.frames[scene as 1 | 2 | 3 | 4].top}%`,
                width: `${art.lantern.frames[scene as 1 | 2 | 3 | 4].width}%`,
                aspectRatio: "2 / 3",
                containerType: "inline-size",
                transition:
                  phase === "flying"
                    ? `left ${scene === 4 ? SCENE_MS[4] : SCENE_MS[2]}ms ease-in-out, top ${scene === 4 ? SCENE_MS[4] : SCENE_MS[2]}ms ease-in-out, width ${scene === 4 ? SCENE_MS[4] : SCENE_MS[2]}ms ease-in-out`
                    : undefined,
              }}
            >
              <Image
                src={art.lantern.src}
                alt=""
                aria-hidden="true"
                fill
                unoptimized
                loading="eager"
                className="pointer-events-none object-contain"
              />
              <div
                className="absolute flex flex-col items-center justify-center"
                style={{
                  left: `${art.lantern.wishBox.left}%`,
                  top: `${art.lantern.wishBox.top}%`,
                  width: `${art.lantern.wishBox.width}%`,
                  height: `${art.lantern.wishBox.height}%`,
                }}
              >
                {writing ? (
                  wishInput("7.6cqw", "5cqw")
                ) : (
                  <p
                    className="pointer-events-none break-keep text-center"
                    aria-hidden="true"
                    style={{
                      fontSize: "7.6cqw",
                      lineHeight: 1.5,
                      color: INK,
                      textShadow: "0 0 4cqw rgba(255,236,190,.9)",
                      opacity: scene <= 2 ? 1 : 0,
                      transition: "opacity 1200ms ease-in",
                    }}
                  >
                    {wish}
                  </p>
                )}
              </div>
            </div>
          )
        ) : writing ? (
          <div className="absolute" style={wishBoxStyle(1)}>
            {wishInput("5.4cqw", "3.2cqw")}
          </div>
        ) : (
          (phase === "flying" || phase === "done") && (
            <p
              className="pointer-events-none absolute break-keep text-center"
              aria-hidden="true"
              style={{
                ...wishBoxStyle(scene),
                fontSize: "5.4cqw",
                lineHeight: 1.5,
                color: INK,
                textShadow: "0 0 2cqw rgba(255,236,190,.9)",
              }}
            >
              {wish}
            </p>
          )
        )}

        {/* 소원 고치는 중이면 왼쪽 위는 "돌아가기" — 고치지 않고 날린 뒤 화면으로(소원은 그대로) */}
        {writing && editing && (
          <button
            type="button"
            onClick={() => {
              setWish(savedWish ?? "");
              showAlready(flownAt);
            }}
            className="absolute z-10 rounded-full border text-night-soft"
            style={{
              left: "4cqw",
              top: "4cqw",
              fontSize: "3.6cqw",
              padding: "1.6cqw 3.4cqw",
              background: "rgba(8,20,42,.55)",
              borderColor: "rgba(188,208,234,.35)",
            }}
          >
            돌아가기
          </button>
        )}
        {/* 나중에 할게요(쓰는 동안 왼쪽 위) */}
        {writing && !editing && (
          <Link
            href="/home"
            replace
            className="absolute z-10 rounded-full border text-night-soft"
            style={{
              left: "4cqw",
              top: "4cqw",
              fontSize: "3.6cqw",
              padding: "1.6cqw 3.4cqw",
              background: "rgba(8,20,42,.55)",
              borderColor: "rgba(188,208,234,.35)",
            }}
          >
            나중에 할게요
          </Link>
        )}

        {/* 날리는 동안(저장 중) 2초마다 바뀌는 안내 */}
        {phase === "flying" && (
          <p
            className="absolute inset-x-0 text-center"
            style={{ bottom: "7%", padding: "0 6cqw" }}
            role="status"
            aria-live="polite"
          >
            <span
              key={caption}
              className="ssol-pulse-text inline-block rounded-full text-night-text"
              style={{
                fontSize: "4cqw",
                padding: "2.2cqw 4.4cqw",
                background: "rgba(8,20,42,.62)",
              }}
            >
              {FLYING_CAPTIONS[caption]}
            </span>
          </p>
        )}

        {/* 끝 화면 문구 — 날린 뒤·이미 날렸을 때는 축하 그림(손글씨 "2027년의 소원을 담은 풍등이 잘 날아갔어요!") 글자 상자 바로 아래에 "지금 몇 km 상공"(대표님 2026-11-25) */}
        {(phase === "done" || phase === "already") && (
          <div
            className="absolute break-keep text-center text-night-text"
            style={{
              left: "9%",
              right: "9%",
              top: `${art?.celebrateTextBottom ?? CELEBRATE_TEXT_BOTTOM}%`,
              padding: "3.4cqw 4cqw",
              background: "rgba(8,20,42,.55)",
              borderRadius: "4cqw",
            }}
          >
            {phase === "done" && (
              <span className="sr-only">{LANTERN_DONE_TEXT}</span>
            )}
            <p role="status" aria-live="polite" className="whitespace-pre-line" style={{ fontSize: "4.2cqw", lineHeight: 1.55 }}>
              {altitudeText}
            </p>
            {phase === "already" && (
              <p
                className="text-night-soft"
                style={{
                  fontSize: "3.3cqw",
                  lineHeight: 1.5,
                  marginTop: "1.6cqw",
                }}
              >
                {LANTERN_ALREADY_SUB}
              </p>
            )}
          </div>
        )}
        {phase === "closed" && (
          <div
            className="absolute break-keep text-center text-night-text"
            role="status"
            style={{
              left: "8%",
              right: "8%",
              top: "22%",
              padding: "5cqw",
              background: "rgba(8,20,42,.62)",
              borderRadius: "5cqw",
            }}
          >
            <p style={{ fontSize: "4.6cqw", lineHeight: 1.6 }}>
              지금은 풍등 날리기 기간이 아니에요.
            </p>
          </div>
        )}

        {/* 아래 버튼 */}
        {message && writing && (
          <p
            className="absolute inset-x-0 break-keep text-center"
            style={{ bottom: "14%", padding: "0 8cqw" }}
            role="alert"
          >
            <span
              className="inline-block rounded-2xl text-night-text"
              style={{
                fontSize: "3.6cqw",
                padding: "1.6cqw 3.6cqw",
                background: "rgba(8,20,42,.7)",
              }}
            >
              {message}
            </span>
          </p>
        )}
        {writing && (
          <button
            type="button"
            onClick={release}
            disabled={!wish.trim()}
            className="absolute left-1/2 -translate-x-1/2 rounded-full font-medium disabled:opacity-55"
            style={{
              bottom: "5%",
              width: "74%",
              fontSize: "4.6cqw",
              padding: "3.2cqw 0",
              background: "var(--night-amber)",
              color: "var(--night-on-amber)",
            }}
          >
            풍등 날리기
          </button>
        )}
        {/* 날린 뒤: 공유하기(카카오톡 로고·색) · 소원 다시 보기 — 홈으로 위에(대표님 2026-11-26), 홈으로는 조금 작게 */}
        {(phase === "done" || phase === "already") && (
          <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: "12.5%", width: "84%" }}>
            {shareNote && (
              <p className="mb-[1.6cqw] text-center text-night-text" role="status" style={{ fontSize: "3.3cqw" }}>
                <span className="inline-block rounded-full" style={{ padding: "1cqw 3cqw", background: "rgba(8,20,42,.6)" }}>
                  {shareNote}
                </span>
              </p>
            )}
            <div className={`grid ${open && savedWish ? "grid-cols-2" : "grid-cols-1"}`} style={{ gap: "2.4cqw" }}>
              <button
                type="button"
                onClick={() => void shareCard()}
                disabled={shareBusy || !(savedWish ?? wish)}
                className="flex items-center justify-center rounded-full font-medium disabled:opacity-55"
                style={{ fontSize: "4.2cqw", padding: "3.1cqw 0", gap: "1.6cqw", background: "#FEE500", color: "#191919" }}
              >
                <KakaoSymbol className="h-[4.6cqw] w-[4.6cqw]" />
                공유하기
              </button>
              {open && savedWish && (
                <button
                  type="button"
                  onClick={() => startEdit(savedWish, flownAt)}
                  className="rounded-full font-medium"
                  style={{ fontSize: "4.2cqw", padding: "3.1cqw 0", background: "rgba(8,20,42,.72)", color: "var(--night-text)", border: "1px solid var(--night-border)" }}
                >
                  소원 다시 보기
                </button>
              )}
            </div>
          </div>
        )}
        {ended && (
          <Link
            href="/home"
            replace
            className="absolute left-1/2 -translate-x-1/2 rounded-full text-center font-medium"
            style={{
              bottom: "5%",
              width: "52%",
              fontSize: "3.8cqw",
              padding: "2.4cqw 0",
              background: "var(--night-amber)",
              color: "var(--night-on-amber)",
            }}
          >
            홈으로
          </Link>
        )}
      </div>
    </div>
  );
}
